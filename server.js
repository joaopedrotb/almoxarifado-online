const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new DatabaseSync(path.join(__dirname, 'almoxarifado.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS empresas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    cnpj TEXT,
    telefone TEXT,
    endereco TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT,
    ncm TEXT,
    empresa_id INTEGER,
    preco_compra REAL DEFAULT 0,
    preco_venda REAL DEFAULT 0,
    quantidade_atual INTEGER DEFAULT 0,
    estoque_minimo INTEGER DEFAULT 0,
    unidade TEXT DEFAULT 'UN',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
  );

  CREATE TABLE IF NOT EXISTS movimentacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida')),
    quantidade INTEGER NOT NULL,
    motivo TEXT,
    data_movimentacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  );
`);

const colunasProdutos = db.prepare(`PRAGMA table_info(produtos)`).all().map(c => c.name);
if (!colunasProdutos.includes('ncm')) {
  db.exec(`ALTER TABLE produtos ADD COLUMN ncm TEXT`);
}

// ========== EMPRESAS ==========
app.get('/api/empresas', (req, res) => {
  const empresas = db.prepare('SELECT * FROM empresas ORDER BY nome').all();
  res.json(empresas);
});

app.post('/api/empresas', (req, res) => {
  try {
    const { nome, cnpj, telefone, endereco } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome e obrigatorio' });
    const result = db.prepare('INSERT INTO empresas (nome, cnpj, telefone, endereco) VALUES (?, ?, ?, ?)').run(nome, cnpj || '', telefone || '', endereco || '');
    res.json({ id: result.lastInsertRowid, nome, cnpj, telefone, endereco });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/empresas/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM empresas WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ========== PRODUTOS ==========
app.get('/api/produtos', (req, res) => {
  const produtos = db.prepare(`
    SELECT p.*, e.nome as empresa_nome
    FROM produtos p
    LEFT JOIN empresas e ON p.empresa_id = e.id
    ORDER BY p.nome
  `).all();
  res.json(produtos);
});

app.get('/api/produtos/:id', (req, res) => {
  const produto = db.prepare(`
    SELECT p.*, e.nome as empresa_nome
    FROM produtos p
    LEFT JOIN empresas e ON p.empresa_id = e.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!produto) return res.status(404).json({ error: 'Produto nao encontrado' });
  res.json(produto);
});

app.post('/api/produtos', (req, res) => {
  try {
    const { codigo, nome, descricao, ncm, empresa_id, preco_compra, preco_venda, quantidade_atual, estoque_minimo, unidade } = req.body;
    if (!codigo || !nome) return res.status(400).json({ error: 'Codigo e nome sao obrigatorios' });
    const result = db.prepare(
      'INSERT INTO produtos (codigo, nome, descricao, ncm, empresa_id, preco_compra, preco_venda, quantidade_atual, estoque_minimo, unidade) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(codigo, nome, descricao || '', ncm || '', empresa_id || null, preco_compra || 0, preco_venda || 0, quantidade_atual || 0, estoque_minimo || 0, unidade || 'UN');
    res.json({ id: result.lastInsertRowid, codigo, nome, descricao, ncm, empresa_id, preco_compra, preco_venda, quantidade_atual, estoque_minimo, unidade });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/produtos/:id', (req, res) => {
  try {
    const { codigo, nome, descricao, ncm, empresa_id, preco_compra, preco_venda, quantidade_atual, estoque_minimo, unidade } = req.body;
    db.prepare(
      'UPDATE produtos SET codigo=?, nome=?, descricao=?, ncm=?, empresa_id=?, preco_compra=?, preco_venda=?, quantidade_atual=?, estoque_minimo=?, unidade=? WHERE id=?'
    ).run(codigo, nome, descricao || '', ncm || '', empresa_id || null, preco_compra || 0, preco_venda || 0, quantidade_atual || 0, estoque_minimo || 0, unidade || 'UN', req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/produtos/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM movimentacoes WHERE produto_id = ?').run(req.params.id);
    db.prepare('DELETE FROM produtos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ========== MOVIMENTACOES ==========
app.get('/api/movimentacoes', (req, res) => {
  const movs = db.prepare(`
    SELECT m.*, p.nome as produto_nome, p.codigo as produto_codigo
    FROM movimentacoes m
    JOIN produtos p ON m.produto_id = p.id
    ORDER BY m.data_movimentacao DESC
  `).all();
  res.json(movs);
});

app.post('/api/movimentacoes', (req, res) => {
  try {
    const { produto_id, tipo, quantidade, motivo } = req.body;
    if (!produto_id || !tipo || !quantidade) {
      return res.status(400).json({ error: 'produto_id, tipo e quantidade sao obrigatorios' });
    }
    if (!['entrada', 'saida'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo deve ser entrada ou saida' });
    }

    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(produto_id);
    if (!produto) return res.status(404).json({ error: 'Produto nao encontrado' });

    const novaQtd = tipo === 'entrada' ? produto.quantidade_atual + quantidade : produto.quantidade_atual - quantidade;
    if (novaQtd < 0) return res.status(400).json({ error: 'Estoque insuficiente. Disponivel: ' + produto.quantidade_atual });

    db.prepare('UPDATE produtos SET quantidade_atual = ? WHERE id = ?').run(novaQtd, produto_id);
    db.prepare('INSERT INTO movimentacoes (produto_id, tipo, quantidade, motivo) VALUES (?, ?, ?, ?)').run(produto_id, tipo, quantidade, motivo || '');

    res.json({ success: true, nova_quantidade: novaQtd });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ========== DASHBOARD ==========
app.get('/api/dashboard', (req, res) => {
  const totalProdutos = db.prepare('SELECT COUNT(*) as total FROM produtos').get().total;
  const totalEstoque = db.prepare('SELECT COALESCE(SUM(quantidade_atual), 0) as total FROM produtos').get().total;
  const totalEmpresas = db.prepare('SELECT COUNT(*) as total FROM empresas').get().total;
  const valorEstoque = db.prepare('SELECT COALESCE(SUM(quantidade_atual * preco_compra), 0) as total FROM produtos').get().total;

  const produtosBaixos = db.prepare(`
    SELECT p.*, e.nome as empresa_nome
    FROM produtos p
    LEFT JOIN empresas e ON p.empresa_id = e.id
    WHERE p.quantidade_atual <= p.estoque_minimo AND p.estoque_minimo > 0
    ORDER BY (p.quantidade_atual * 1.0 / p.estoque_minimo) ASC
    LIMIT 10
  `).all();

  const topSaidas = db.prepare(`
    SELECT p.id, p.codigo, p.nome, p.quantidade_atual, COALESCE(SUM(m.quantidade), 0) as total_saidas
    FROM produtos p
    LEFT JOIN movimentacoes m ON p.id = m.produto_id AND m.tipo = 'saida'
    GROUP BY p.id
    ORDER BY total_saidas DESC
    LIMIT 10
  `).all();

  const topEntradas = db.prepare(`
    SELECT p.id, p.codigo, p.nome, p.quantidade_atual, COALESCE(SUM(m.quantidade), 0) as total_entradas
    FROM produtos p
    LEFT JOIN movimentacoes m ON p.id = m.produto_id AND m.tipo = 'entrada'
    GROUP BY p.id
    ORDER BY total_entradas DESC
    LIMIT 10
  `).all();

  const ultimasMovimentacoes = db.prepare(`
    SELECT m.*, p.nome as produto_nome, p.codigo as produto_codigo
    FROM movimentacoes m
    JOIN produtos p ON m.produto_id = p.id
    ORDER BY m.data_movimentacao DESC
    LIMIT 10
  `).all();

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
