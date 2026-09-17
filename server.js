const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== CAMADA DE DADOS (JSON em arquivo) ==========
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'almoxarifado.json');
const SEED_FILE = path.join(DATA_DIR, 'produtos-iniciais.json');

function now() {
  const d = new Date(Date.now() + (-3 * 3600 * 1000));
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function criarStoreVazio() {
  return {
    seqEmpresas: 0,
    seqProdutos: 0,
    seqMovimentacoes: 0,
    empresas: [],
    produtos: [],
    movimentacoes: [],
    criado_em: now()
  };
}

function salvar() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function carregar() {
  if (!fs.existsSync(DATA_FILE)) {
    store = criarStoreVazio();
    if (fs.existsSync(SEED_FILE)) {
      try {
        const iniciais = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
        iniciais.forEach(p => {
          store.seqProdutos++;
          store.produtos.push({
            id: store.seqProdutos,
            codigo: p.codigo,
            nome: p.nome,
            descricao: p.descricao || '',
            ncm: p.ncm || '',
            empresa_id: null,
            preco_compra: p.preco_compra || 0,
            preco_venda: p.preco_venda || 0,
            quantidade_atual: p.quantidade_atual || 0,
            estoque_minimo: p.estoque_minimo || 0,
            unidade: p.unidade || 'UN',
            criado_em: now()
          });
        });
        console.log('Seed inicial aplicado: ' + store.produtos.length + ' produtos');
      } catch (e) {
        console.log('Falha ao aplicar seed: ' + e.message);
      }
    }
    salvar();
  } else {
    store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
}

let store;
carregar();

function nomeEmpresa(id) {
  const e = store.empresas.find(e => e.id === Number(id));
  return e ? e.nome : null;
}

function produtoCompleto(p) {
  return { ...p, empresa_nome: p.empresa_id ? nomeEmpresa(p.empresa_id) : null };
}

function movCompleto(m) {
  const p = store.produtos.find(prod => prod.id === m.produto_id);
  return { ...m, produto_nome: p ? p.nome : null, produto_codigo: p ? p.codigo : null };
}

// ========== EMPRESAS ==========
app.get('/api/empresas', (req, res) => {
  const lista = [...store.empresas].sort((a, b) => a.nome.localeCompare(b.nome));
  res.json(lista);
});

app.post('/api/empresas', (req, res) => {
  const { nome, cnpj, telefone, endereco } = req.body || {};
  if (!nome) return res.status(400).json({ error: 'Nome e obrigatorio' });
  if (store.empresas.some(e => e.nome.toLowerCase() === String(nome).toLowerCase())) {
    return res.status(400).json({ error: 'Empresa ja cadastrada' });
  }
  store.seqEmpresas++;
  const empresa = {
    id: store.seqEmpresas,
    nome,
    cnpj: cnpj || '',
    telefone: telefone || '',
    endereco: endereco || '',
    criado_em: now()
  };
  store.empresas.push(empresa);
  salvar();
  res.json(empresa);
});

app.delete('/api/empresas/:id', (req, res) => {
  const id = Number(req.params.id);
  store.empresas = store.empresas.filter(e => e.id !== id);
  store.produtos.forEach(p => { if (p.empresa_id === id) p.empresa_id = null; });
  salvar();
  res.json({ success: true });
});

// ========== PRODUTOS ==========
app.get('/api/produtos', (req, res) => {
  const lista = [...store.produtos].sort((a, b) => a.nome.localeCompare(b.nome));
  res.json(lista.map(produtoCompleto));
});

app.get('/api/produtos/:id', (req, res) => {
  const p = store.produtos.find(prod => prod.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Produto nao encontrado' });
  res.json(produtoCompleto(p));
});

app.post('/api/produtos', (req, res) => {
  const { codigo, nome, descricao, ncm, empresa_id, preco_compra, preco_venda, quantidade_atual, estoque_minimo, unidade } = req.body || {};
  if (!codigo || !nome) return res.status(400).json({ error: 'Codigo e nome sao obrigatorios' });
  if (store.produtos.some(p => p.codigo.toLowerCase() === String(codigo).toLowerCase())) {
    return res.status(400).json({ error: 'Codigo de produto ja cadastrado: UNIQUE constraint failed' });
  }
  store.seqProdutos++;
  const produto = {
    id: store.seqProdutos,
    codigo,
    nome,
    descricao: descricao || '',
    ncm: ncm || '',
    empresa_id: empresa_id ? Number(empresa_id) : null,
    preco_compra: Number(preco_compra) || 0,
    preco_venda: Number(preco_venda) || 0,
    quantidade_atual: parseInt(quantidade_atual) || 0,
    estoque_minimo: parseInt(estoque_minimo) || 0,
    unidade: unidade || 'UN',
    criado_em: now()
  };
  store.produtos.push(produto);
  salvar();
  res.json(produto);
});

app.put('/api/produtos/:id', (req, res) => {
  const id = Number(req.params.id);
  const p = store.produtos.find(prod => prod.id === id);
  if (!p) return res.status(404).json({ error: 'Produto nao encontrado' });
  const { codigo, nome, descricao, ncm, empresa_id, preco_compra, preco_venda, quantidade_atual, estoque_minimo, unidade } = req.body || {};
  if (codigo && store.produtos.some(prod => prod.id !== id && prod.codigo.toLowerCase() === String(codigo).toLowerCase())) {
    return res.status(400).json({ error: 'Codigo de produto ja cadastrado' });
  }
  if (codigo) p.codigo = codigo;
  if (nome) p.nome = nome;
  p.descricao = descricao !== undefined ? descricao : p.descricao;
  p.ncm = ncm !== undefined ? ncm : p.ncm;
  p.empresa_id = empresa_id !== undefined ? (empresa_id ? Number(empresa_id) : null) : p.empresa_id;
  p.preco_compra = preco_compra !== undefined ? Number(preco_compra) || 0 : p.preco_compra;
  p.preco_venda = preco_venda !== undefined ? Number(preco_venda) || 0 : p.preco_venda;
  p.quantidade_atual = quantidade_atual !== undefined ? parseInt(quantidade_atual) || 0 : p.quantidade_atual;
  p.estoque_minimo = estoque_minimo !== undefined ? parseInt(estoque_minimo) || 0 : p.estoque_minimo;
  p.unidade = unidade !== undefined ? unidade : p.unidade;
  salvar();
  res.json(produtoCompleto(p));
});

app.delete('/api/produtos/:id', (req, res) => {
  const id = Number(req.params.id);
  store.produtos = store.produtos.filter(p => p.id !== id);
  store.movimentacoes = store.movimentacoes.filter(m => m.produto_id !== id);
  salvar();
  res.json({ success: true });
});

// ========== MOVIMENTACOES ==========
app.get('/api/movimentacoes', (req, res) => {
  const lista = [...store.movimentacoes].sort((a, b) => (b.data_movimentacao || '').localeCompare(a.data_movimentacao || ''));
  res.json(lista.map(movCompleto));
});

app.post('/api/movimentacoes', (req, res) => {
  const { produto_id, tipo, quantidade, motivo } = req.body || {};
  if (!produto_id || !tipo || !quantidade) {
    return res.status(400).json({ error: 'produto_id, tipo e quantidade sao obrigatorios' });
  }
  if (!['entrada', 'saida'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo deve ser entrada ou saida' });
  }
  const produto = store.produtos.find(p => p.id === Number(produto_id));
  if (!produto) return res.status(404).json({ error: 'Produto nao encontrado' });

  const qtd = parseInt(quantidade);
  if (typeof qtd !== 'number' || isNaN(qtd) || qtd <= 0) {
    return res.status(400).json({ error: 'Quantidade invalida' });
  }
  const novaQtd = tipo === 'entrada' ? produto.quantidade_atual + qtd : produto.quantidade_atual - qtd;
  if (novaQtd < 0) return res.status(400).json({ error: 'Estoque insuficiente. Disponivel: ' + produto.quantidade_atual });

  produto.quantidade_atual = novaQtd;
  store.seqMovimentacoes++;
  store.movimentacoes.push({
    id: store.seqMovimentacoes,
    produto_id: Number(produto_id),
    tipo,
    quantidade: qtd,
    motivo: motivo || '',
    data_movimentacao: now()
  });
  salvar();
  res.json({ success: true, nova_quantidade: novaQtd });
});

// ========== DASHBOARD ==========
app.get('/api/dashboard', (req, res) => {
  const totalProdutos = store.produtos.length;
  const totalEstoque = store.produtos.reduce((s, p) => s + (p.quantidade_atual || 0), 0);
  const totalEmpresas = store.empresas.length;
  const valorEstoque = store.produtos.reduce((s, p) => s + (p.quantidade_atual || 0) * (p.preco_compra || 0), 0);

  const produtosBaixos = store.produtos
    .filter(p => p.estoque_minimo > 0 && p.quantidade_atual <= p.estoque_minimo)
    .sort((a, b) => (a.quantidade_atual / a.estoque_minimo) - (b.quantidade_atual / b.estoque_minimo))
    .slice(0, 10)
    .map(produtoCompleto);

  const topSaidas = store.produtos.map(p => ({
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    quantidade_atual: p.quantidade_atual,
    total_saidas: store.movimentacoes
      .filter(m => m.produto_id === p.id && m.tipo === 'saida')
      .reduce((s, m) => s + m.quantidade, 0)
  })).sort((a, b) => b.total_saidas - a.total_saidas).slice(0, 10);

  const topEntradas = store.produtos.map(p => ({
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    quantidade_atual: p.quantidade_atual,
    total_entradas: store.movimentacoes
      .filter(m => m.produto_id === p.id && m.tipo === 'entrada')
      .reduce((s, m) => s + m.quantidade, 0)
  })).sort((a, b) => b.total_entradas - a.total_entradas).slice(0, 10);

  const ultimasMovimentacoes = [...store.movimentacoes]
    .sort((a, b) => (b.data_movimentacao || '').localeCompare(a.data_movimentacao || ''))
    .slice(0, 10)
    .map(movCompleto);

  res.json({
    totalProdutos,
    totalEstoque,
    totalEmpresas,
    valorEstoque,
    produtosBaixos,
    topSaidas,
    topEntradas,
    ultimasMovimentacoes
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});