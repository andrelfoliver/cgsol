from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import date
from database import db, Projeto

app = Flask(__name__)
CORS(app)

# ====== CONFIG ======
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:postgres@localhost:5432/projetos_db'  # <— use localhost se a API roda fora do Docker
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ECHO'] = True  # loga INSERT/UPDATE/SELECT
db.init_app(app)

def _parse_date(s):
    try:
        return date.fromisoformat(s) if s else None
    except Exception:
        return None

# ====== ROTAS ======
@app.route('/api/projetos', methods=['GET'])
def listar_projetos():
    itens = Projeto.query.order_by(Projeto.id.desc()).all()
    return jsonify([p.to_dict() for p in itens]), 200

@app.route('/api/projetos', methods=['POST'])
def criar_projeto():
    data = request.get_json() or {}
    app.logger.info("POST /api/projetos payload=%s", data)

    # só pega campos conhecidos e converte datas
    payload = {
        'nome':        data.get('nome'),
        'tipo':        data.get('tipo'),
        'coordenacao': data.get('coordenacao'),
        'status':      data.get('status'),
        'descricao':   data.get('descricao'),
        'inicio':      _parse_date(data.get('inicio')),
        'fim':         _parse_date(data.get('fim')),
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
        if 'nome'        in data: p.nome        = data['nome']
        if 'tipo'        in data: p.tipo        = data['tipo']
        if 'coordenacao' in data: p.coordenacao = data['coordenacao']
        if 'status'      in data: p.status      = data['status']
        if 'descricao'   in data: p.descricao   = data['descricao']
        if 'inicio'      in data: p.inicio      = _parse_date(data['inicio'])
        if 'fim'         in data: p.fim         = _parse_date(data['fim'])
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

if __name__ == '__main__':
    with app.app_context():
        print("DB URI:", app.config['SQLALCHEMY_DATABASE_URI'])
        db.create_all()
    app.run(host='0.0.0.0', port=5000, debug=True)
