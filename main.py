from fastapi import FastAPI

app = FastAPI(title="Crossbrite Evaluation Service")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Crossbrite Evaluation Service API!"}