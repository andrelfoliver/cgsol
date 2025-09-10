from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Projeto(db.Model):
    __tablename__ = 'projetos'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    descricao = db.Column(db.Text, nullable=True)
    coordenacao = db.Column(db.String(50), nullable=False)
    tipo = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    inicio = db.Column(db.String(10), nullable=True)
    fim = db.Column(db.String(10), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "descricao": self.descricao,
            "coordenacao": self.coordenacao,
            "tipo": self.tipo,
            "status": self.status,
            "inicio": self.inicio,
            "fim": self.fim
        }
