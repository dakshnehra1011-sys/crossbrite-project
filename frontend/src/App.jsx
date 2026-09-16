import React, { useState, useEffect } from "react";
import "./App.css";

const API_URL = "http://localhost:8000";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  const handleLogout = () => setCurrentUser(null);

  return (
    <div className="container">
      <header className="header">
        <h1>CROSSBRITE</h1>
        {currentUser && (
          <div style={{ textAlign: "right" }}>
            <div className="user-info">
              Welcome, {currentUser.username}
              <span className="role">#{currentUser.id} | {currentUser.role}</span>
            </div>
          </div>
        )}
      </header>
      
      {!currentUser ? (
        <AuthScreen onAuthSuccess={setCurrentUser} />
      ) : (
        <>
          <div style={{ marginBottom: "40px", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleLogout} className="swiss-btn danger outline">Logout</button>
          </div>

          <main>
            {currentUser.role === "admin" && <AdminTab user={currentUser} />}
            {currentUser.role === "teacher" && <TeacherTab user={currentUser} />}
            {currentUser.role === "parent" && <ParentTab user={currentUser} />}
          </main>
        </>
      )}
    </div>
  );
}

// ----------------- AUTH SCREEN -----------------
function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    
    const endpoint = isLogin ? "/login" : "/signup";
    const payload = isLogin ? { user_id: parseInt(inputValue), password } : { name: inputValue, password, role };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Auth failed");
      
      if (!isLogin) {
        setSuccessMsg(`ACCOUNT CREATED. ID: ${data.id}. Save this to login.`);
        setIsLogin(true);
        setInputValue("");
      } else {
        onAuthSuccess(data); 
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>{isLogin ? "Portal Login" : "Register"}</h2>
        
        {error && <div className="status-badge pending" style={{ borderColor: "var(--accent-red)", color: "var(--accent-red)" }}>{error}</div>}
        {successMsg && <div className="status-badge evaluated">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="form-group">
          <input 
            type={isLogin ? "number" : "text"}
            placeholder={isLogin ? "ID NUMBER" : "FULL NAME"} 
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)} 
            required 
            className="swiss-input"
          />
          <input 
            type="password"
            placeholder="PASSWORD"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="swiss-input"
          />
          
          {!isLogin && (
            <select value={role} onChange={e => setRole(e.target.value)} className="swiss-input">
              <option value="teacher">TEACHER</option>
              <option value="parent">PARENT</option>
            </select>
          )}
          <button type="submit" className="swiss-btn">
            {isLogin ? "Enter" : "Generate ID"}
          </button>
        </form>
        
        <p style={{ marginTop: "30px", cursor: "pointer", fontWeight: "600", textDecoration: "underline" }} onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "NEW USER? REGISTER" : "HAVE AN ID? LOGIN"}
        </p>
      </div>
    </div>
  );
}

// ----------------- ADMIN DASHBOARD -----------------
function AdminTab({ user }) {
  const [sessions, setSessions] = useState([]);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const headers = { "Authorization": `Bearer ${user.token}`, "Content-Type": "application/json" };

  const [pendingUsers, setPendingUsers] = useState([]);

  const loadSessions = async () => {
    const response = await fetch(`${API_URL}/sessions/`, { headers });
    if (response.ok) setSessions(await response.json());
  };

  const loadPendingUsers = async () => {
    const response = await fetch(`${API_URL}/users/pending`, { headers });
    if (response.ok) setPendingUsers(await response.json());
  };
  
  useEffect(() => { 
    loadSessions(); 
    loadPendingUsers();
  }, []);

  const approveUser = async (userId) => {
    const response = await fetch(`${API_URL}/users/${userId}/approve`, { method: "POST", headers });
    if (response.ok) loadPendingUsers();
  };

  const deleteSession = async (sessionId) => {
    if (!window.confirm("SUPERUSER: FORCE DELETE?")) return;
    const response = await fetch(`${API_URL}/sessions/${sessionId}`, { method: "DELETE", headers });
    if (response.ok) loadSessions();
  };

  const startEditing = (session) => {
    setEditingSessionId(session.id);
    setEditTitle(session.title);
    setEditDesc(session.description);
  };

  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditTitle("");
    setEditDesc("");
  };

  const updateSession = async (sessionId) => {
    const response = await fetch(`${API_URL}/sessions/${sessionId}`, { 
      method: "PUT", headers, body: JSON.stringify({ title: editTitle, description: editDesc })
    });
    if (response.ok) {
      cancelEditing();
      loadSessions();
    } else {
      alert("Failed to update session.");
    }
  };

  const triggerEvaluation = async (sessionId) => {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/evaluate`, { method: "POST", headers });
    if (response.ok) {
      alert("TRIGGERED!");
      loadSessions(); 
    }
  };

  return (
    <div>
      <div className="swiss-banner admin">
        <h2>SUPERUSER COMMAND</h2>
        <button onClick={loadSessions} className="swiss-btn outline" style={{ borderColor: "#fff", color: "#fff" }}>Sync</button>
      </div>

      {pendingUsers.length > 0 && (
        <div style={{ marginBottom: "40px" }}>
          <h3 style={{ textTransform: "uppercase", borderBottom: "3px solid var(--border-heavy)", paddingBottom: "10px" }}>
            PENDING APPROVALS ({pendingUsers.length})
          </h3>
          <div className="dashboard-grid" style={{ marginTop: "20px" }}>
            {pendingUsers.map(u => (
              <div key={u.id} className="swiss-card" style={{ borderColor: "var(--accent-red)" }}>
                <h4>{u.username}</h4>
                <div className="meta">ROLE: {u.role} | ID: #{u.id}</div>
                <div className="actions" style={{ borderTop: "none" }}>
                  <button onClick={() => approveUser(u.id)} className="swiss-btn">APPROVE</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 style={{ textTransform: "uppercase", borderBottom: "3px solid var(--border-heavy)", paddingBottom: "10px" }}>ALL SESSIONS</h3>
      <div className="dashboard-grid" style={{ marginTop: "20px" }}>
        {sessions.map(s => {
          const evalData = s.evaluations && s.evaluations.length > 0 ? s.evaluations[0] : null;

          return (
            <div key={s.id} className="swiss-card">
              {editingSessionId === s.id ? (
                <div className="form-group" style={{ marginBottom: "20px" }}>
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="swiss-input" />
                  <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="swiss-input" rows="3" />
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => updateSession(s.id)} className="swiss-btn">Save</button>
                    <button onClick={cancelEditing} className="swiss-btn outline">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <h4>{s.title}</h4>
                  <p>{s.description}</p>
                  <div className="meta">OWNER: #{s.teacher_id}</div>
                  
                  {evalData ? (
                    <div className="status-badge evaluated">
                      STATUS: {evalData.status} | SCORE: {evalData.score}
                      <div style={{ marginTop: "10px", fontSize: "0.8rem", textTransform: "none", fontWeight: "400" }}>{evalData.feedback}</div>
                    </div>
                  ) : (
                    <div className="status-badge pending">AWAITING EVALUATION</div>
                  )}

                  <div className="actions">
                    <button onClick={() => startEditing(s)} className="swiss-btn warning">EDIT</button>
                    <button onClick={() => triggerEvaluation(s.id)} className="swiss-btn outline">EVAL</button>
                    <button onClick={() => deleteSession(s.id)} className="swiss-btn danger">DEL</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------- TEACHER DASHBOARD -----------------
function TeacherTab({ user }) {
  const [dbSessions, setDbSessions] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const headers = { "Authorization": `Bearer ${user.token}`, "Content-Type": "application/json" };

  const loadMySessions = async () => {
    const response = await fetch(`${API_URL}/sessions/`, { headers });
    if (response.ok) setDbSessions(await response.json());
  };

  useEffect(() => { loadMySessions(); }, []);

  const createSession = async (e) => {
    e.preventDefault();
    const response = await fetch(`${API_URL}/sessions/`, {
      method: "POST", headers, body: JSON.stringify({ title: newTitle, description: newDesc }),
    });
    if (response.ok) {
      setNewTitle(""); setNewDesc(""); loadMySessions();
    }
  };

  const deleteSession = async (sessionId) => {
    if (!window.confirm("CONFIRM DELETE?")) return;
    const response = await fetch(`${API_URL}/sessions/${sessionId}`, { method: "DELETE", headers });
    if (response.ok) loadMySessions();
  };

  const startEditing = (session) => {
    setEditingSessionId(session.id);
    setEditTitle(session.title);
    setEditDesc(session.description);
  };

  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditTitle("");
    setEditDesc("");
  };

  const updateSession = async (sessionId) => {
    const response = await fetch(`${API_URL}/sessions/${sessionId}`, { 
      method: "PUT", headers, body: JSON.stringify({ title: editTitle, description: editDesc })
    });
    if (response.ok) {
      cancelEditing();
      loadMySessions();
    } else {
      alert("Failed to update session.");
    }
  };

  const triggerEvaluation = async (sessionId) => {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/evaluate`, { method: "POST", headers });
    if (response.ok) {
      alert("EVALUATION TRIGGERED!");
      loadMySessions();
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "60px" }}>
        <div className="swiss-banner">
          <h2>CREATE NEW SESSION</h2>
        </div>
        <form onSubmit={createSession} className="form-group" style={{ maxWidth: "600px" }}>
          <input placeholder="TITLE" value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="swiss-input" />
          <textarea placeholder="DESCRIPTION" value={newDesc} onChange={e => setNewDesc(e.target.value)} required className="swiss-input" rows="3" />
          <button type="submit" className="swiss-btn" style={{ width: "fit-content" }}>DEPLOY SESSION</button>
        </form>
      </div>

      <div>
        <div className="swiss-banner">
          <h2>ACTIVE SESSIONS</h2>
        </div>
        
        {dbSessions.length === 0 && <p>No sessions found.</p>}
        
        <div className="dashboard-grid" style={{ marginTop: "0" }}>
          {dbSessions.map((s) => {
            const evalData = s.evaluations && s.evaluations.length > 0 ? s.evaluations[0] : null;
            return (
              <div key={s.id} className="swiss-card">
                {editingSessionId === s.id ? (
                  <div className="form-group" style={{ marginBottom: "20px" }}>
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="swiss-input" />
                    <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="swiss-input" rows="3" />
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button onClick={() => updateSession(s.id)} className="swiss-btn">Save</button>
                      <button onClick={cancelEditing} className="swiss-btn outline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4>{s.title}</h4>
                    <p>{s.description}</p>
                    
                    {evalData ? (
                      <div className="status-badge evaluated">
                        SCORE: {evalData.score} | {evalData.feedback.substring(0, 30)}...
                      </div>
                    ) : (
                      <div className="status-badge pending">AWAITING EVALUATION</div>
                    )}

                    <div className="actions">
                      <button onClick={() => startEditing(s)} className="swiss-btn warning">EDIT</button>
                      <button onClick={() => triggerEvaluation(s.id)} className="swiss-btn">EVAL</button>
                      <button onClick={() => deleteSession(s.id)} className="swiss-btn danger">DEL</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----------------- PARENT DASHBOARD -----------------
function ParentTab({ user }) {
  const [sessions, setSessions] = useState([]);
  const [msg, setMsg] = useState("");

  const loadSessions = async () => {
    const response = await fetch(`${API_URL}/sessions/`, {
      headers: { "Authorization": `Bearer ${user.token}` }
    });
    if (response.ok) setSessions(await response.json());
  };

  useEffect(() => { 
    loadSessions(); 
    const interval = setInterval(loadSessions, 3000);
    return () => clearInterval(interval);
  }, []);

  const testParentAccess = async () => {
    const response = await fetch(`${API_URL}/sessions/`, {
      method: "POST",
      headers: { "x-user-id": String(user.id), "x-user-role": user.role, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hack Attempt", description: "Bypass RBAC" }),
    });
    if (response.status === 403) setMsg("ACCESS DENIED (403)");
  };

  return (
    <div>
      <div className="swiss-banner" style={{ background: "var(--border-color)", color: "var(--text-primary)", borderColor: "var(--text-primary)", boxShadow: "none" }}>
        <h2>PARENT TERMINAL (READ-ONLY)</h2>
        <button onClick={testParentAccess} className="swiss-btn outline">SECURITY TEST</button>
      </div>
      
      {msg && <div className="status-badge pending" style={{ borderColor: "var(--accent-red)", color: "var(--accent-red)" }}>{msg}</div>}

      <div className="dashboard-grid">
        {sessions.length === 0 && <p>No active sessions available.</p>}
        {sessions.map(s => {
          const evalData = s.evaluations && s.evaluations.length > 0 ? s.evaluations[0] : null;

          return (
            <div key={s.id} className="swiss-card">
              <h4>{s.title}</h4>
              <p>{s.description}</p>
              <div className="meta">TEACHER ID: #{s.teacher_id}</div>
              
              {evalData && evalData.status === "Evaluated" ? (
                <div className="status-badge evaluated">
                  SCORE: {evalData.score}
                  <div style={{ marginTop: "10px", fontSize: "0.8rem", textTransform: "none", fontWeight: "400" }}>{evalData.feedback}</div>
                </div>
              ) : (
                <div className="status-badge pending">EVALUATION PENDING</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}