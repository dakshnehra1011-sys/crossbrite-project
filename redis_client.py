import redis
import json


redis_conn = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

def trigger_evaluation_task(session_id: int):
    job_data = {
        "session_id": session_id, 
        "task": "run_llm_evaluation",
        "status": "queued"
    }
    redis_conn.lpush("evaluation_queue", json.dumps(job_data))
    return True