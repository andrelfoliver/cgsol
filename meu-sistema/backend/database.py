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
    internalizacao = db.Column(db.Boolean, default=False)


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
            'qualidade': self.qualidade,
            'internalizacao': self.internalizacao,

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
class PDTIAction(db.Model):
    __tablename__ = 'pdti_acoes'

    id = db.Column(db.String(20), primary_key=True)   # Ex: AC.SDF.01
    descricao = db.Column(db.Text, nullable=False)
    situacao = db.Column(db.String(50), nullable=False, default="Não iniciada")
    tipo = db.Column(db.String(10), nullable=False)   # SDF, SDD, SDS
    data_conclusao = db.Column(db.Date, nullable=True)  # ✅ novo campo

    def to_dict(self):
        return {
            'id': self.id,
            'descricao': self.descricao,
            'situacao': self.situacao,
            'tipo': self.tipo,
            'data_conclusao': self.data_conclusao.isoformat() if self.data_conclusao else None
        }

class SustentacaoChamado(db.Model):
    __tablename__ = "sustentacao_chamados"

    id = db.Column(db.Integer, primary_key=True)
    numero_chamado = db.Column(db.String(50), unique=True, nullable=False)
    projeto = db.Column(db.String(100), nullable=False)
    desenvolvedor = db.Column(db.String(100))
    data_chamado = db.Column(db.DateTime)
    descricao = db.Column(db.Text)
    solicitante = db.Column(db.String(150))
    status = db.Column(db.String(50))
    observacao = db.Column(db.Text)
    criado_em = db.Column(db.DateTime, default=db.func.now())
    atualizado_em = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
