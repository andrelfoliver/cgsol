from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy()

class Projeto(db.Model):
    __tablename__ = 'projetos'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(255), nullable=False)
    tipo = db.Column(db.String(100), nullable=False)
    coordenacao = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    descricao = db.Column(db.Text)
    inicio = db.Column(db.Date)
    fim = db.Column(db.Date)

    # Novos campos extras
    prioridade = db.Column(db.String(50))
    progresso = db.Column(db.Integer)             # 0–100
    totalSprints = db.Column(db.Integer)
    sprintsConcluidas = db.Column(db.Integer)
    responsavel = db.Column(db.String(100))
    orcamento = db.Column(db.Float)
    equipe = db.Column(db.Text)                   # nomes separados por vírgula
    rag = db.Column(db.String(20))
    riscos = db.Column(db.Text)
    qualidade = db.Column(db.Integer)

    def to_dict(self):
        return {
            'id': self.id,
            'nome': self.nome,
            'tipo': self.tipo,
            'coordenacao': self.coordenacao,
            'status': self.status,
            'descricao': self.descricao,
            'inicio': self.inicio.isoformat() if self.inicio else None,
            'fim': self.fim.isoformat() if self.fim else None,
            'prioridade': self.prioridade,
            'progresso': self.progresso,
            'totalSprints': self.totalSprints,
            'sprintsConcluidas': self.sprintsConcluidas,
            'responsavel': self.responsavel,
            'orcamento': self.orcamento,
            'equipe': self.equipe,
            'rag': self.rag,
            'riscos': self.riscos,
            'qualidade': self.qualidade
        }
class Andamento(db.Model):
    __tablename__ = 'andamentos'
    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey('projetos.id', ondelete='CASCADE'))
    data = db.Column(db.DateTime, default=db.func.now())
    descricao = db.Column(db.Text, nullable=False)

    projeto = db.relationship('Projeto', backref=db.backref('andamentos', cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'projeto_id': self.projeto_id,
            'data': self.data.isoformat() if self.data else None,
            'descricao': self.descricao
        }
