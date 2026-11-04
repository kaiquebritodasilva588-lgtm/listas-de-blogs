// Posts e comentários lidos de arquivos JSON locais (em português).
// O envio de comentários (POST) vai para uma API simulada, que não grava de verdade.
const ARQUIVO_POSTS = "posts.json";
const ARQUIVO_COMENTARIOS = "comentarios.json";
const API_POST = "https://jsonplaceholder.typicode.com";
const app = document.getElementById("app");

// ---------- Utilidades ----------

// Cria um elemento com texto seguro (textContent evita injeção de HTML)
function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  filhos.forEach(f => e.append(f));
  return e;
}

// Busca JSON e lança erro se a resposta não for 2xx
async function buscarJSON(url, opcoes) {
  const resposta = await fetch(url, opcoes);
  if (!resposta.ok) throw new Error(`Erro ${resposta.status} ao acessar a API.`);
  return resposta.json();
}

// Abrir o index.html com duplo clique (file://) faz o navegador bloquear o fetch de arquivos locais
function mensagemDeErro(erro, padrao) {
  if (location.protocol === "file:") {
    return "O navegador bloqueia a leitura dos arquivos JSON ao abrir o arquivo direto. " +
           "Use um servidor local (extensão Live Server do VS Code ou 'python -m http.server').";
  }
  return erro.message || padrao;
}

function mostrarEstado(texto, ehErro = false) {
  app.replaceChildren(el("p", { className: "estado" + (ehErro ? " erro" : ""), textContent: texto }));
}

// ---------- Tela 1: lista de posts ----------

async function mostrarLista() {
  document.title = "Blog Fetch API";
  mostrarEstado("Carregando posts…");
  try {
    const posts = await buscarJSON(ARQUIVO_POSTS);
    const ul = el("ul", { className: "lista" });

    posts.forEach(post => {
      const link = el("a", { href: `#post-${post.id}` },
        el("div", { className: "titulo", textContent: post.title }),
        el("div", { className: "resumo", textContent: post.body.split("\n")[0] + "…" })
      );
      ul.append(el("li", {}, link));
    });

    app.replaceChildren(el("h1", { textContent: "Posts recentes" }), ul);
  } catch (erro) {
    mostrarEstado(mensagemDeErro(erro, "Não foi possível carregar os posts."), true);
  }
}

// ---------- Tela 2: detalhes do post + comentários ----------

async function mostrarPost(id) {
  mostrarEstado("Carregando post e comentários…");
  try {
    // Requisições simultâneas: as duas começam ao mesmo tempo
    const [post, comentarios] = await Promise.all([
      buscarJSON(ARQUIVO_POSTS).then(lista => lista.find(p => p.id === Number(id))),
      buscarJSON(ARQUIVO_COMENTARIOS).then(lista => lista.filter(c => c.postId === Number(id)))
    ]);
    if (!post) throw new Error("Post não encontrado.");

    document.title = post.title + " · Blog Fetch API";

    const listaComentarios = el("div");
    const contador = el("h2");
    const atualizarContador = () => {
      const n = listaComentarios.children.length;
      contador.textContent = `${n} comentário${n === 1 ? "" : "s"}`;
    };
    comentarios.forEach(c => listaComentarios.append(criarComentario(c.name, c.email, c.body)));
    atualizarContador();

    app.replaceChildren(
      el("a", { href: "#", className: "voltar", textContent: "← Voltar para os posts" }),
      el("h1", { textContent: post.title }),
      el("p", { className: "autor", textContent: `Por ${post.autor}` }),
      el("p", { className: "post-corpo", textContent: post.body }),
      contador,
      listaComentarios,
      criarFormulario(post.id, listaComentarios, atualizarContador)
    );
  } catch (erro) {
    mostrarEstado(mensagemDeErro(erro, "Não foi possível carregar o post."), true);
    app.append(el("a", { href: "#", className: "voltar", textContent: "← Voltar para os posts" }));
  }
}

function criarComentario(nome, email, texto, ehNovo = false) {
  return el("article", { className: "comentario" + (ehNovo ? " novo" : "") },
    el("strong", { textContent: nome }),
    el("small", { textContent: email }),
    el("p", { textContent: texto })
  );
}

// ---------- Envio de novo comentário (POST) ----------

function criarFormulario(postId, listaComentarios, atualizarContador) {
  const nome = el("input", { name: "nome", required: true, maxLength: 60 });
  const email = el("input", { name: "email", type: "email", required: true });
  const texto = el("textarea", { name: "texto", rows: 4, required: true, maxLength: 500 });
  const botao = el("button", { type: "submit", textContent: "Enviar comentário" });
  const aviso = el("p", { className: "msg-ok" });

  const form = el("form", {},
    el("label", { textContent: "Nome" }, nome),
    el("label", { textContent: "E-mail" }, email),
    el("label", { textContent: "Comentário" }, texto),
    botao,
    aviso
  );

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    botao.disabled = true;
    botao.textContent = "Enviando…";
    aviso.className = "msg-ok";
    aviso.textContent = "";

    try {
      const criado = await buscarJSON(`${API_POST}/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({
          postId,
          name: nome.value.trim(),
          email: email.value.trim(),
          body: texto.value.trim()
        })
      });

      // A API só simula: devolve o objeto com um id novo, mas não salva.
      // Por isso exibimos o comentário retornado na própria página.
      listaComentarios.append(criarComentario(criado.name, criado.email, criado.body, true));
      atualizarContador();
      form.reset();
      aviso.textContent = `Comentário enviado (id ${criado.id} na API simulada).`;
    } catch (erro) {
      aviso.className = "msg-ok erro";
      aviso.textContent = erro.message || "Falha ao enviar. Tente novamente.";
    } finally {
      botao.disabled = false;
      botao.textContent = "Enviar comentário";
    }
  });

  return el("section", {}, el("h2", { textContent: "Deixe um comentário" }), form);
}

// ---------- Roteamento simples por hash (#post-3) ----------

function rotear() {
  const m = location.hash.match(/^#post-(\d+)$/);
  window.scrollTo(0, 0);
  m ? mostrarPost(m[1]) : mostrarLista();
}

window.addEventListener("hashchange", rotear);
rotear();
