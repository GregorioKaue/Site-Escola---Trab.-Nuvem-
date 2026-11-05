// Cliente da API para o frontend (GitHub Pages). Fica em  pages/api.js  e cada página o carrega
// com uma tag script (src="api.js") colocada ANTES do script principal da própria página.

// Endereço da API Node.js/Express.
// - Em desenvolvimento (página aberta em localhost/127.0.0.1) usa o servidor local na porta 3000.
// - Em produção (GitHub Pages) usa o endereço público do serviço no Render (sem barra no final).
// >>> TROQUE a URL de produção abaixo pelo endereço real do seu serviço. <<<
const API_LOCAL = "http://localhost:3000";
const API_PRODUCAO = "https://trab-nuvem.onrender.com";
const API_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname) ? API_LOCAL : API_PRODUCAO;

// Função base: faz a chamada HTTP, envia o token e trata os erros de forma única.
async function api(caminho, { metodo = "GET", corpo } = {}) { // Recebe o caminho, o método e o corpo (opcional)
  if (API_URL.includes("https://trab-nuvem.onrender.com")) { // Esqueceu de configurar o endereço da API
    throw new Error("Configure API_URL em pages/api.js com o endereço do seu serviço no Render.");
  }
  const token = sessionStorage.getItem("token"); // Lê o token de login guardado na sessão do navegador
  const cabecalhos = { "Content-Type": "application/json" }; // Todo envio e resposta é JSON
  if (token) cabecalhos.Authorization = "Bearer " + token; // Se houver login, anexa o token ao cabeçalho
  let resposta; // Guardará a resposta do servidor
  try { // Tenta se comunicar com a API
    resposta = await fetch(API_URL + caminho, { // Faz a requisição
      method: metodo, // GET, POST, PUT ou DELETE
      headers: cabecalhos, // Cabeçalhos montados acima
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined // Converte o corpo em JSON (se existir)
    }); // Fecha o fetch
  } catch (e) { // Falha de rede (API acordando, sem internet, CORS bloqueado)
    throw new Error("Não foi possível conectar ao servidor. Se o serviço estava inativo, aguarde cerca de 1 minuto e tente de novo."); // Mensagem amigável
  } // Fecha try/catch
  const dados = await resposta.json().catch(() => ({})); // Lê o JSON da resposta (ou objeto vazio se não houver)
  if (resposta.status === 401 && token) { // Token vencido ou inválido
    const eProfessor = !!sessionStorage.getItem("professorLogado"); // Descobre qual login usar
    sessionStorage.clear(); // Apaga a sessão antiga
    window.location.href = eProfessor ? "loginProf.html" : "login.html"; // Volta para a tela de login correta
  } // Fecha o if do 401
  if (!resposta.ok) throw new Error(dados.erro || dados.mensagem || dados.message || "Erro inesperado."); // Qualquer erro HTTP vira exceção com a mensagem da API
  return dados; // Devolve os dados da resposta
} // Fecha api()

// ---------- Sessão ----------
// Lê o usuário da sessão ("aluno" ou "professor"). Sem login válido, manda para a tela de entrada e devolve null.
function exigirSessao(tipo) {
  const chave = tipo === "professor" ? "professorLogado" : "usuarioLogado"; // Onde cada login guarda seus dados
  let dados = null;
  try { dados = JSON.parse(sessionStorage.getItem(chave)); } catch (e) { /* sessão corrompida: trata como sem login */ }
  if (!dados || !sessionStorage.getItem("token")) {
    window.location.href = tipo === "professor" ? "loginProf.html" : "login.html";
    return null;
  }
  return dados;
}

// Encerra a sessão e volta para a tela de login.
function sairDaSessao(destino) {
  sessionStorage.clear(); // Apaga token e dados do usuário
  window.location.href = destino;
}

// ---------- Foto ----------
// Reduz a imagem escolhida (lado maior = 400 px, JPEG) antes de enviar: a API recusa fotos acima de ~1 MB.
function reduzirImagem(arquivo, lado = 400) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; // Fundo branco (PNG transparente não vira preto no JPEG)
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler esta imagem.")); };
    img.src = url;
  });
}

// ---------- Atalhos por assunto (um por rota da API) ----------
const EduAPI = { // Objeto que agrupa todas as chamadas
  // Autenticação
  loginAluno: (email, senha) => api("/api/auth/login/aluno", { metodo: "POST", corpo: { email, senha } }), // login.html
  loginProfessor: (email, senha) => api("/api/auth/login/professor", { metodo: "POST", corpo: { email, senha } }), // loginProf.html
  esqueciSenha: email => api("/api/auth/esqueci-senha", { metodo: "POST", corpo: { email } }), // esqueci-senha.html (só o e-mail; CPF não é mais exigido)
  redefinirSenha: (token, novaSenha) => api("/api/auth/redefinir-senha", { metodo: "POST", corpo: { token, novaSenha } }), // redefinir-senha.html

  // Cadastro (cadastro.html): o servidor valida, grava a senha com hash (bcrypt) e rejeita e-mail repetido. CPF e código da escola NÃO são mais exigidos
  cadastrarAluno: dados => api("/api/auth/cadastro/aluno", { metodo: "POST", corpo: dados }), // { nome, email, turma, senha } (cpf é opcional)
  cadastrarProfessor: dados => api("/api/auth/cadastro/professor", { metodo: "POST", corpo: dados }), // { nome, email, disciplina, senha } (cpf é opcional)

  // Aluno
  perfil: () => api("/api/aluno/perfil"), // Cabeçalho do perfil (inclui foto)
  salvarFoto: foto => api("/api/aluno/foto", { metodo: "PUT", corpo: { foto } }), // Foto em data-URL (ou null para remover)
  desempenho: () => api("/api/aluno/desempenho"), // Notas, faltas, bimestres e documentos

  // Professor
  anos: () => api("/api/professor/anos"), // Lista de anos letivos
  novoAno: ano => api("/api/professor/anos", { metodo: "POST", corpo: { ano } }), // Botão "+ Ano"
  alunos: () => api("/api/professor/alunos"), // Lista de alunos
  novoAluno: dados => api("/api/professor/alunos", { metodo: "POST", corpo: dados }), // Botão "+ Novo aluno"
  editarAluno: (id, dados) => api("/api/professor/alunos/" + id, { metodo: "PUT", corpo: dados }), // Botão "Editar dados"
  excluirAluno: id => api("/api/professor/alunos/" + id, { metodo: "DELETE" }), // Botão "Excluir"
  lancamentos: (id, ano) => api("/api/professor/alunos/" + id + "/lancamentos/" + ano), // Carrega o editor
  salvarLancamentos: (id, ano, corpo) => api("/api/professor/alunos/" + id + "/lancamentos/" + ano, { metodo: "PUT", corpo }), // Botão "Salvar alterações"

  // Secretaria
  solicitar: dados => api("/api/secretaria/solicitacoes", { metodo: "POST", corpo: dados }), // Formulário da secretaria
  consultarProtocolo: protocolo => api("/api/secretaria/solicitacoes/" + encodeURIComponent(protocolo)) // Andamento do pedido
}; // Fecha EduAPI
