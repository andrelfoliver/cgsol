from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import date
from database import db, Projeto, Andamento


app = Flask(__name__, static_url_path="/api")
CORS(app)

# ====== CONFIG ======
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:postgres@db:5432/projetos_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ECHO'] = True  # loga INSERT/UPDATE/SELECT
db.init_app(app)
with app.app_context():
    print("Campos do modelo Projeto:", [c.name for c in Projeto.__table__.columns])

def _parse_date(s):
    try:
        return date.fromisoformat(s) if s else None
    except Exception:
        return None

# ====== ROTAS ======
@app.route('/api/sustentacao')
def listar_sustentacao():
    dados_fake = [
        {"aplicacao": "CNES", "status": "Fechado", "sla": "No prazo"},
        {"aplicacao": "CNES", "status": "Aberto", "sla": "Fora do prazo"},
        {"aplicacao": "PAT", "status": "Fechado", "sla": "No prazo"},
        {"aplicacao": "PAT", "status": "Fechado", "sla": "No prazo"},
        {"aplicacao": "SIRH", "status": "Aberto", "sla": "No prazo"}
    ]
    return jsonify(dados_fake)

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

