FROM python:3.11

WORKDIR /app
# Instala netcat
RUN apt-get update && apt-get install -y netcat-openbsd

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENTRYPOINT ["./wait-for-db.sh"]
CMD ["python", "app.py"]
