from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import date
from database import db, Projeto, Andamento


app = Flask(__name__)   # <- só isso
CORS(app,
     resources={r"/api/*": {"origins": "*"}},
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
# modelo sustentacao_chamados (precisa estar definido em database.py)
from database import SustentacaoChamado  



# ====== CONFIG ======
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:postgres@db:5432/projetos_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ECHO'] = True  # loga INSERT/UPDATE/SELECT
db.init_app(app)
with app.app_context():
    print("Campos do modelo Projeto:", [c.name for c in Projeto.__table__.columns])

from datetime import date, datetime

def _parse_date(s: str | None):
    try:
        return date.fromisoformat((s or '').split('T')[0]) if s else None
    except Exception:
        return None

def _parse_datetime(s: str | None):
    """Aceita '2025-09-23', '2025-09-23T14:30', ou '...Z'"""
    try:
        if not s:
            return None
        s = s.replace('Z', '+00:00')   # ISO com Z
        dt = datetime.fromisoformat(s)
        return dt.replace(tzinfo=None) # salva naive (sem tz)
    except Exception:
        return None


# ====== ROTAS ======
@app.route('/api/sustentacao', methods=['GET'])
def listar_sustentacao():
    chamados = SustentacaoChamado.query.order_by(SustentacaoChamado.data_chamado.desc()).all()
    return jsonify([{
        "numero_chamado": c.numero_chamado,
        "projeto": c.projeto,
        "desenvolvedor": c.desenvolvedor,
        "data_chamado": c.data_chamado.isoformat() if c.data_chamado else None,
        "descricao": c.descricao,
        "solicitante": c.solicitante,
        "status": c.status,
        "observacao": c.observacao
    } for c in chamados])

# ========= SUSTENTAÇÃO: CRUD =========

# Criar (opcional)
@app.route('/api/sustentacao', methods=['POST'])
def criar_chamado_sustentacao():
    data = request.get_json() or {}
    app.logger.info("POST /api/sustentacao payload=%s", data)

    novo = SustentacaoChamado(
        numero_chamado = data.get('numero_chamado'),
        projeto        = data.get('projeto'),
        desenvolvedor  = data.get('desenvolvedor'),
        data_chamado   = _parse_datetime(data.get('data_chamado')),  # <- AQUI
        descricao      = data.get('descricao'),
        solicitante    = data.get('solicitante'),
        status         = data.get('status'),
        observacao     = data.get('observacao')
    )
    db.session.add(novo)
    db.session.commit()
    return jsonify({
        "numero_chamado": novo.numero_chamado, "projeto": novo.projeto,
        "desenvolvedor": novo.desenvolvedor,
        "data_chamado": novo.data_chamado.isoformat() if novo.data_chamado else None,
        "descricao": novo.descricao, "solicitante": novo.solicitante,
        "status": novo.status, "observacao": novo.observacao
    }), 201


# Atualizar por número do chamado (é o que o front usa)
@app.route('/api/sustentacao/<string:numero>', methods=['PUT'])
def editar_chamado_sustentacao(numero):
    data = request.get_json() or {}
    app.logger.info("PUT /api/sustentacao/%s payload=%s", numero, data)

    ch = SustentacaoChamado.query.filter_by(numero_chamado=numero).first_or_404()

    try:
        for fld in ('projeto','desenvolvedor','descricao','solicitante','status','observacao'):
            if fld in data:
                setattr(ch, fld, data[fld])

        if 'data_chamado' in data:
            ch.data_chamado = _parse_datetime(data.get('data_chamado'))  # <- AQUI

        db.session.commit()
        return jsonify({
            "numero_chamado": ch.numero_chamado, "projeto": ch.projeto,
            "desenvolvedor": ch.desenvolvedor,
            "data_chamado": ch.data_chamado.isoformat() if ch.data_chamado else None,
            "descricao": ch.descricao, "solicitante": ch.solicitante,
            "status": ch.status, "observacao": ch.observacao
        }), 200
    except Exception as e:
        db.session.rollback()
        app.logger.exception("Erro ao atualizar chamado de sustentação")
        return jsonify({'erro': str(e)}), 400


# Excluir por número (opcional)
@app.route('/api/sustentacao/<string:numero>', methods=['DELETE'])
def deletar_chamado_sustentacao(numero):
    ch = SustentacaoChamado.query.filter_by(numero_chamado=numero).first_or_404()
    db.session.delete(ch)
    db.session.commit()
    return jsonify({'mensagem': 'Chamado excluído com sucesso'}), 200

# Editar andamento
@app.route('/api/andamentos/<int:andamento_id>', methods=['PUT'])
def editar_andamento(andamento_id):
    data = request.get_json() or {}
    andamento = Andamento.query.get_or_404(andamento_id)

    try:
        if 'descricao' in data:
            andamento.descricao = data['descricao']

        db.session.commit()
        return jsonify(andamento.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        app.logger.exception("Erro ao atualizar andamento")
        return jsonify({'erro': str(e)}), 400

def _parse_bool(v):
    if isinstance(v, bool):
        return v
    if v is None:
        return False
    if isinstance(v, (int, float)):
        return bool(v)
    s = str(v).strip().lower()
    return s in ('1', 'true', 't', 'yes', 'y', 'on', 'sim')


# Excluir andamento
@app.route('/api/andamentos/<int:andamento_id>', methods=['DELETE'])
def deletar_andamento(andamento_id):
    andamento = Andamento.query.get_or_404(andamento_id)
    try:
        db.session.delete(andamento)
        db.session.commit()
        return jsonify({'mensagem': 'Andamento excluído com sucesso'}), 200
    except Exception as e:
        db.session.rollback()
        app.logger.exception("Erro ao deletar andamento")
        return jsonify({'erro': str(e)}), 400

from database import SustentacaoObservacao, SustentacaoChamado  # garantir import

# Listar e criar observações de um chamado
# Listar e criar observações de um chamado
@app.route('/api/sustentacao/<string:numero>/observacoes', methods=['GET', 'POST'])
def sust_obs_list_create(numero):
    # Garante que o chamado existe
    SustentacaoChamado.query.filter_by(numero_chamado=numero).first_or_404()

    if request.method == 'POST':
        data = (request.get_json() or {})
        texto = (data.get('texto') or '').strip()
        # 👇 ADICIONE ESTE LOG
        app.logger.info("POST /api/sustentacao/%s/observacoes texto=%r", numero, texto)

        if not texto:
            return jsonify({'erro': 'Texto é obrigatório'}), 400

        row = SustentacaoObservacao(numero_chamado=numero, texto=texto)
        db.session.add(row)
        db.session.commit()
        return jsonify(row.to_dict()), 201

    itens = SustentacaoObservacao.query.filter_by(numero_chamado=numero)\
        .order_by(SustentacaoObservacao.criado_em.desc())\
        .all()
    return jsonify([r.to_dict() for r in itens]), 200

# Editar/Excluir uma observação específica
@app.route('/api/sustentacao/observacoes/<int:oid>', methods=['PUT', 'DELETE'])
def sust_obs_update_delete(oid):
    row = SustentacaoObservacao.query.get_or_404(oid)

    if request.method == 'DELETE':
        db.session.delete(row)
        db.session.commit()
        return ('', 204)  # No Content

    data = (request.get_json() or {})
    texto = (data.get('texto') or '').strip()
    if not texto:
        return jsonify({'erro': 'Texto é obrigatório'}), 400

    row.texto = texto
    db.session.commit()
    return jsonify(row.to_dict()), 200



   

# Listar histórico de um projeto
@app.route('/api/projetos/<int:id>/andamentos', methods=['GET'])
def listar_andamentos(id):
    ands = Andamento.query.filter_by(projeto_id=id).order_by(Andamento.data.desc()).all()
    return jsonify([a.to_dict() for a in ands]), 200

# Adicionar novo andamento
@app.route('/api/projetos/<int:id>/andamentos', methods=['POST'])
def criar_andamento(id):
    data = request.get_json() or {}
    novo = Andamento(projeto_id=id, descricao=data.get('descricao'))
    db.session.add(novo)
    db.session.commit()
    return jsonify(novo.to_dict()), 201

@app.route('/api/projetos', methods=['GET'])
def listar_projetos():
    itens = Projeto.query.order_by(Projeto.id.desc()).all()
    return jsonify([p.to_dict() for p in itens]), 200

@app.route('/api/projetos', methods=['POST'])
def criar_projeto():
    data = request.get_json() or {}
    app.logger.info("POST /api/projetos payload=%s", data)

    payload = {
        'nome':        data.get('nome'),
        'tipo':        data.get('tipo'),
        'coordenacao': data.get('coordenacao'),
        'status':      data.get('status'),
        'descricao':   data.get('descricao'),
        'inicio':      _parse_date(data.get('inicio')),
        'fim':         _parse_date(data.get('fim')),
        'internalizacao': _parse_bool(data.get('internalizacao', False)),


        # extras
        'prioridade':        data.get('prioridade'),
        'progresso':         data.get('progresso'),
        'totalSprints':      data.get('totalSprints'),
        'sprintsConcluidas': data.get('sprintsConcluidas'),
        'responsavel':       data.get('responsavel'),
        'orcamento':         data.get('orcamento'),
        'equipe':            data.get('equipe'),
        'rag':               data.get('rag'),
        'riscos':            data.get('riscos'),
        'qualidade':         data.get('qualidade'),
    }

    try:
        projeto = Projeto(**payload)
        db.session.add(projeto)
        db.session.commit()
        return jsonify(projeto.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        app.logger.exception("Erro ao salvar projeto")
        return jsonify({'erro': str(e)}), 400


@app.route('/api/projetos/<int:id>', methods=['PUT'])
def editar_projeto(id):
    data = request.get_json() or {}
    p = Projeto.query.get_or_404(id)

    try:
        for field in [
            'nome','tipo','coordenacao','status','descricao',
            'prioridade','progresso','totalSprints','sprintsConcluidas',
            'responsavel','orcamento','equipe','rag','riscos','qualidade'
        ]:
            if field in data:
                setattr(p, field, data[field])

        if 'internalizacao' in data:
            p.internalizacao = _parse_bool(data['internalizacao'])

        if 'inicio' in data: p.inicio = _parse_date(data['inicio'])
        if 'fim' in data:    p.fim    = _parse_date(data['fim'])

        db.session.commit()
        return jsonify(p.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        app.logger.exception("Erro ao atualizar projeto")
        return jsonify({'erro': str(e)}), 400


@app.route('/api/projetos/<int:id>', methods=['DELETE'])
def deletar_projeto(id):
    p = Projeto.query.get_or_404(id)
    try:
        db.session.delete(p)
        db.session.commit()
        return jsonify({'mensagem': 'Projeto excluído com sucesso'}), 200
    except Exception as e:
        db.session.rollback()
        app.logger.exception("Erro ao deletar projeto")
        return jsonify({'erro': str(e)}), 400

from database import db, PDTIAction

# Listar
@app.route("/api/pdti", methods=["GET"])
def listar_pdti():
    itens = PDTIAction.query.order_by(PDTIAction.id).all()
    return jsonify([a.to_dict() for a in itens])

# Criar
@app.route("/api/pdti", methods=["POST"])
def criar_pdti():
    data = request.get_json() or {}
    situacao = data.get("situacao", "Não iniciada")

    novo = PDTIAction(
        id=data.get("id"),
        descricao=data.get("descricao"),
        situacao=situacao,
        tipo=data.get("tipo"),
        data_conclusao=date.today() if situacao == "Concluída" else None
    )

    db.session.add(novo)
    db.session.commit()
    return jsonify(novo.to_dict()), 201

    data = request.get_json() or {}
    novo = PDTIAction(
        id=data.get("id"),
        descricao=data.get("descricao"),
        situacao=data.get("situacao", "Não iniciada"),
        tipo=data.get("tipo"),
    )
    db.session.add(novo)
    db.session.commit()
    return jsonify(novo.to_dict()), 201

# Editar
@app.route("/api/pdti/<string:acao_id>", methods=["PUT"])
def editar_pdti(acao_id):
    acao = PDTIAction.query.get_or_404(acao_id)
    data = request.get_json() or {}

    if "descricao" in data:
        acao.descricao = data["descricao"]
    if "tipo" in data:
        acao.tipo = data["tipo"]

    if "situacao" in data:
        acao.situacao = data["situacao"]
        if acao.situacao == "Concluída" and not acao.data_conclusao:
            acao.data_conclusao = date.today()
        elif acao.situacao != "Concluída":
            acao.data_conclusao = None

    db.session.commit()
    return jsonify(acao.to_dict())


# Excluir
@app.route("/api/pdti/<string:acao_id>", methods=["DELETE"])
def deletar_pdti(acao_id):
    acao = PDTIAction.query.get_or_404(acao_id)
    db.session.delete(acao)
    db.session.commit()
    return jsonify({"mensagem": "Ação excluída com sucesso"})

if __name__ == '__main__':
    with app.app_context():
        print("DB URI:", app.config['SQLALCHEMY_DATABASE_URI'])
        db.create_all()
    app.run(host='0.0.0.0', port=5001, debug=True)  # <- troquei para 5001

