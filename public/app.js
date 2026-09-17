const API = {
  get: async (url) => (await fetch(url)).json(),
  post: async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
    return data;
  },
  put: async (url, body) => {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar');
    return data;
  },
  del: async (url) => {
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao excluir');
    return data;
  }
};

let produtos = [];
let empresas = [];
let movimentacoes = [];

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ========== NAVEGAÇÃO ==========
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    if (page === 'dashboard') carregarDashboard();
    if (page === 'produtos') carregarProdutos();
    if (page === 'empresas') carregarEmpresas();
    if (page === 'movimentacoes') carregarMovimentacoes();
  });
});

// ========== MODAIS ==========
function showModal(tipo) {
  if (tipo === 'produto') {
    document.getElementById('form-produto').reset();
    document.getElementById('produto-id').value = '';
    document.getElementById('modal-produto-title').textContent = 'Novo Produto';
    carregarSelectEmpresas();
  }
  document.getElementById('modal-' + tipo).classList.add('show');
}

function showModalProdutoEdit(produto) {
  document.getElementById('form-produto').reset();
  document.getElementById('produto-id').value = produto.id;
  document.getElementById('produto-codigo').value = produto.codigo;
  document.getElementById('produto-nome').value = produto.nome;
  document.getElementById('produto-descricao').value = produto.descricao || '';
  document.getElementById('produto-ncm').value = produto.ncm || '';
  document.getElementById('produto-preco-compra').value = produto.preco_compra || 0;
  document.getElementById('produto-preco-venda').value = produto.preco_venda || 0;
  document.getElementById('produto-quantidade').value = produto.quantidade_atual || 0;
  document.getElementById('produto-minimo').value = produto.estoque_minimo || 0;
  document.getElementById('produto-unidade').value = produto.unidade || 'UN';
  carregarSelectEmpresas().then(() => {
    document.getElementById('produto-empresa').value = produto.empresa_id || '';
  });
  document.getElementById('modal-produto-title').textContent = 'Editar Produto';
  document.getElementById('modal-produto').classList.add('show');
}

function closeModal(tipo) {
  document.getElementById('modal-' + tipo).classList.remove('show');
}

// ========== DASHBOARD ==========
async function carregarDashboard() {
  const data = await API.get('/api/dashboard');
  document.getElementById('stat-produtos').textContent = data.totalProdutos;
  document.getElementById('stat-estoque').textContent = data.totalEstoque;
  document.getElementById('stat-empresas').textContent = data.totalEmpresas;
  document.getElementById('stat-valor').textContent = formatBRL(data.valorEstoque);

  renderTopSaidas(data.topSaidas);
  renderTopEntradas(data.topEntradas);
  renderEstoqueBaixo(data.produtosBaixos);
  renderUltimasMovs(data.ultimasMovimentacoes);
}

function renderTopSaidas(saidas) {
  const tbody = document.getElementById('top-saidas');
  tbody.innerHTML = '';
  const semSaida = saidas.every(s => s.total_saidas === 0);
  document.getElementById('empty-saidas').style.display = semSaida ? 'block' : 'none';
  if (semSaida) return;
  saidas.forEach(s => {
    tbody.innerHTML += `<tr><td>${s.codigo}</td><td>${s.nome}</td><td>${s.quantidade_atual}</td><td><b>${s.total_saidas}</b></td></tr>`;
  });
}

function renderTopEntradas(entradas) {
  const tbody = document.getElementById('top-entradas');
  tbody.innerHTML = '';
  const semEntrada = entradas.every(e => e.total_entradas === 0);
  document.getElementById('empty-entradas').style.display = semEntrada ? 'block' : 'none';
  if (semEntrada) return;
  entradas.forEach(e => {
    tbody.innerHTML += `<tr><td>${e.codigo}</td><td>${e.nome}</td><td>${e.quantidade_atual}</td><td><b>${e.total_entradas}</b></td></tr>`;
  });
}

function renderEstoqueBaixo(produtos) {
  const tbody = document.getElementById('estoque-baixo');
  tbody.innerHTML = '';
  document.getElementById('empty-baixos').style.display = produtos.length ? 'none' : 'block';
  produtos.forEach(p => {
    const badge = p.quantidade_atual <= p.estoque_minimo ? '<span class="badge badge-alerta">ALERTA</span>' : '<span class="badge badge-ok">OK</span>';
    tbody.innerHTML += `<tr><td>${p.codigo}</td><td>${p.nome}</td><td><b>${p.quantidade_atual}</b> ${badge}</td><td>${p.estoque_minimo}</td></tr>`;
  });
}

function renderUltimasMovs(movs) {
  const tbody = document.getElementById('ultimas-movs');
  tbody.innerHTML = '';
  document.getElementById('empty-movs').style.display = movs.length ? 'none' : 'block';
  movs.forEach(m => {
    const badge = m.tipo === 'entrada' ? '<span class="badge badge-entrada">ENTRADA</span>' : '<span class="badge badge-saida">SAIDA</span>';
    const sinal = m.tipo === 'entrada' ? '+' : '-';
    tbody.innerHTML += `<tr><td>${formatDate(m.data_movimentacao)}</td><td>${badge}</td><td>${m.produto_nome}</td><td>${sinal}${m.quantidade}</td></tr>`;
  });
}

// ========== PRODUTOS ==========
async function carregarProdutos() {
  produtos = await API.get('/api/produtos');
  renderProdutos(produtos);
}

function renderProdutos(lista) {
  const tbody = document.getElementById('lista-produtos');
  tbody.innerHTML = '';
  document.getElementById('empty-produtos').style.display = lista.length ? 'none' : 'block';
  lista.forEach(p => {
    const alerta = p.estoque_minimo > 0 && p.quantidade_atual <= p.estoque_minimo
      ? '<span class="badge badge-alerta">BAIXO</span>'
      : '<span class="badge badge-ok">OK</span>';
    tbody.innerHTML += `
      <tr>
        <td><b>${p.codigo}</b></td>
        <td>${p.nome}</td>
        <td>${p.empresa_nome || '-'}</td>
        <td>${p.ncm || '-'}</td>
        <td>${formatBRL(p.preco_compra)}</td>
        <td>${formatBRL(p.preco_venda)}</td>
        <td><b>${p.quantidade_atual}</b> ${p.unidade}</td>
        <td>${p.estoque_minimo}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-secondary" onclick="showModalProdutoEdit(${JSON.stringify(p).replace(/"/g, '&quot;')})">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="excluirProduto(${p.id}, '${p.nome.replace(/'/g, "\\'")}')">Excluir</button>
          </div>
        </td>
      </tr>
    `;
  });
}

function filtrarProdutos() {
  const termo = document.getElementById('search-produtos').value.toLowerCase();
  const filtrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo) || (p.ncm || '').toLowerCase().includes(termo)
  );
  renderProdutos(filtrados);
}

async function salvarProduto(e) {
  e.preventDefault();
  const id = document.getElementById('produto-id').value;
  const body = {
    codigo: document.getElementById('produto-codigo').value.trim(),
    nome: document.getElementById('produto-nome').value.trim(),
    descricao: document.getElementById('produto-descricao').value.trim(),
    ncm: document.getElementById('produto-ncm').value.trim(),
    empresa_id: document.getElementById('produto-empresa').value || null,
    preco_compra: parseFloat(document.getElementById('produto-preco-compra').value) || 0,
    preco_venda: parseFloat(document.getElementById('produto-preco-venda').value) || 0,
    quantidade_atual: parseInt(document.getElementById('produto-quantidade').value) || 0,
    estoque_minimo: parseInt(document.getElementById('produto-minimo').value) || 0,
    unidade: document.getElementById('produto-unidade').value
  };
  try {
    if (id) {
      await API.put('/api/produtos/' + id, body);
      showToast('Produto atualizado com sucesso!');
    } else {
      await API.post('/api/produtos', body);
      showToast('Produto cadastrado com sucesso!');
    }
    closeModal('produto');
    carregarProdutos();
    carregarDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function excluirProduto(id, nome) {
  if (!confirm(`Excluir o produto "${nome}"?\nEssa acao nao pode ser desfeita.`)) return;
  try {
    await API.del('/api/produtos/' + id);
    showToast('Produto excluido!');
    carregarProdutos();
    carregarDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ========== EMPRESAS ==========
async function carregarEmpresas() {
  empresas = await API.get('/api/empresas');
  renderEmpresas(empresas);
}

function renderEmpresas(lista) {
  const tbody = document.getElementById('lista-empresas');
  tbody.innerHTML = '';
  document.getElementById('empty-empresas').style.display = lista.length ? 'none' : 'block';
  lista.forEach(e => {
    tbody.innerHTML += `
      <tr>
        <td><b>${e.id}</b></td>
        <td>${e.nome}</td>
        <td>${e.cnpj || '-'}</td>
        <td>${e.telefone || '-'}</td>
        <td>${e.endereco || '-'}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-danger" onclick="excluirEmpresa(${e.id}, '${e.nome.replace(/'/g, "\\'")}')">Excluir</button>
          </div>
        </td>
      </tr>
    `;
  });
}

async function carregarSelectEmpresas() {
  empresas = await API.get('/api/empresas');
  const select = document.getElementById('produto-empresa');
  select.innerHTML = '<option value="">Selecione...</option>';
  empresas.forEach(e => {
    select.innerHTML += `<option value="${e.id}">${e.nome}</option>`;
  });
}

async function salvarEmpresa(e) {
  e.preventDefault();
  const body = {
    nome: document.getElementById('empresa-nome').value.trim(),
    cnpj: document.getElementById('empresa-cnpj').value.trim(),
    telefone: document.getElementById('empresa-telefone').value.trim(),
    endereco: document.getElementById('empresa-endereco').value.trim()
  };
  try {
    await API.post('/api/empresas', body);
    showToast('Empresa cadastrada com sucesso!');
    closeModal('empresa');
    carregarEmpresas();
    carregarDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function excluirEmpresa(id, nome) {
  if (!confirm(`Excluir a empresa "${nome}"?`)) return;
  try {
    await API.del('/api/empresas/' + id);
    showToast('Empresa excluida!');
    carregarEmpresas();
    carregarDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ========== MOVIMENTACOES ==========
async function carregarMovimentacoes() {
  movimentacoes = await API.get('/api/movimentacoes');
  renderMovimentacoes(movimentacoes);
  await carregarSelectProdutos();
}

function renderMovimentacoes(lista) {
  const tbody = document.getElementById('lista-movimentacoes');
  tbody.innerHTML = '';
  document.getElementById('empty-movimentacoes').style.display = lista.length ? 'none' : 'block';
  lista.forEach(m => {
    const badge = m.tipo === 'entrada' ? '<span class="badge badge-entrada">ENTRADA</span>' : '<span class="badge badge-saida">SAIDA</span>';
    const sinal = m.tipo === 'entrada' ? '+' : '-';
    tbody.innerHTML += `
      <tr>
        <td>${formatDate(m.data_movimentacao)}</td>
        <td>${badge}</td>
        <td><b>${m.produto_codigo}</b></td>
        <td>${m.produto_nome}</td>
        <td><b>${sinal}${m.quantidade}</b></td>
        <td>${m.motivo || '-'}</td>
      </tr>
    `;
  });
}

function filtrarMovimentacoes() {
  const termo = document.getElementById('search-movs').value.toLowerCase();
  const filtrados = movimentacoes.filter(m =>
    m.produto_nome.toLowerCase().includes(termo) || m.produto_codigo.toLowerCase().includes(termo) || (m.motivo || '').toLowerCase().includes(termo)
  );
  renderMovimentacoes(filtrados);
}

async function carregarSelectProdutos() {
  const select = document.getElementById('mov-produto');
  select.innerHTML = '<option value="">Selecione...</option>';
  produtos = await API.get('/api/produtos');
  produtos.forEach(p => {
    select.innerHTML += `<option value="${p.id}">${p.codigo} - ${p.nome} (Estoque: ${p.quantidade_atual})</option>`;
  });
}

async function salvarMovimentacao(e) {
  e.preventDefault();
  const body = {
    produto_id: document.getElementById('mov-produto').value,
    tipo: document.getElementById('mov-tipo').value,
    quantidade: parseInt(document.getElementById('mov-quantidade').value),
    motivo: document.getElementById('mov-motivo').value.trim()
  };
  try {
    await API.post('/api/movimentacoes', body);
    showToast('Movimentacao registrada com sucesso!');
    closeModal('movimentacao');
    carregarMovimentacoes();
    carregarProdutos();
    carregarDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  carregarDashboard();
});