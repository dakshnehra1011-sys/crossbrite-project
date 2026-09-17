import React, { useState, useEffect } from "react";
import "./App.css";

const API_URL = "http://localhost:8000";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  const handleLogout = () => setCurrentUser(null);

  return (
    <div className="container">
      <header className="header" style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.5rem", letterSpacing: "-1px" }}>CROSSBRITE</h1>
        {currentUser && (
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div className="user-info" style={{ fontSize: "0.95rem" }}>
              Welcome, {currentUser.username}
              <span className="role">#{currentUser.id} | {currentUser.role}</span>
            </div>
            <button onClick={handleLogout} className="swiss-btn danger outline" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>Logout</button>
          </div>
        )}
      </header>
      
      {!currentUser ? (
        <AuthScreen onAuthSuccess={setCurrentUser} />
      ) : (
        <main>
          {currentUser.role === "admin" && <AdminTab user={currentUser} />}
          {currentUser.role === "teacher" && <TeacherTab user={currentUser} />}
          {currentUser.role === "parent" && <ParentTab user={currentUser} />}
        </main>
      )}
    </div>
  );
}


function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentRoll, setStudentRoll] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    
    const endpoint = isLogin ? "/login" : "/signup";
    let payload = isLogin ? { user_id: parseInt(inputValue), password } : { name: inputValue, password, role };
    
    if (!isLogin && role === "parent") {
      payload = { ...payload, student_name: studentName, student_roll: studentRoll };
    }

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
          {!isLogin && role === "parent" && (
            <>
              <input 
                type="text"
                placeholder="CHILD'S NAME"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                required
                className="swiss-input"
              />
              <input 
                type="text"
                placeholder="CHILD'S ROLL NUMBER"
                value={studentRoll}
                onChange={e => setStudentRoll(e.target.value)}
                required
                className="swiss-input"
              />
            </>
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


function AdminTab({ user }) {
  const [sessions, setSessions] = useState([]);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const headers = { "Authorization": `Bearer ${user.token}`, "Content-Type": "application/json" };

  const [pendingUsers, setPendingUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [managingSessionId, setManagingSessionId] = useState(null);
  const [sessionEnrollments, setSessionEnrollments] = useState([]);
  const [activeTab, setActiveTab] = useState("users");

  const loadSessions = async () => {
    const response = await fetch(`${API_URL}/sessions/`, { headers });
    if (response.ok) setSessions(await response.json());
  };

  const loadPendingUsers = async () => {
    const response = await fetch(`${API_URL}/users/pending`, { headers });
    if (response.ok) setPendingUsers(await response.json());
  };

  const loadAllUsers = async () => {
    const response = await fetch(`${API_URL}/users`, { headers });
    if (response.ok) setUsers(await response.json());
  };

  const loadAllStudents = async () => {
    const response = await fetch(`${API_URL}/students`, { headers });
    if (response.ok) setAllStudents(await response.json());
  };
  
  useEffect(() => { 
    loadSessions(); 
    loadPendingUsers();
    loadAllUsers();
    loadAllStudents();
  }, []);

  const approveUser = async (userId) => {
    const response = await fetch(`${API_URL}/users/${userId}/approve`, { method: "POST", headers });
    if (response.ok) { loadPendingUsers(); loadAllUsers(); }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("SUPERUSER: DELETE USER? This cannot be undone.")) return;
    const response = await fetch(`${API_URL}/users/${id}`, { method: "DELETE", headers });
    if (response.ok) { loadAllUsers(); loadSessions(); }
  };

  const changePassword = async (id) => {
    const newPwd = window.prompt("Enter new password for user:");
    if (!newPwd) return;
    const response = await fetch(`${API_URL}/users/${id}/password`, { 
      method: "PUT", headers, body: JSON.stringify({ new_password: newPwd }) 
    });
    if (response.ok) alert("PASSWORD UPDATED!");
  };

  const openEnrollments = async (sessionId) => {
    setManagingSessionId(sessionId);
    const response = await fetch(`${API_URL}/sessions/${sessionId}/students`, { headers });
    if (response.ok) setSessionEnrollments(await response.json());
  };

  const closeEnrollments = () => {
    setManagingSessionId(null);
    setSessionEnrollments([]);
  };

  const toggleStudent = async (studentId, isEnrolled) => {
    const method = isEnrolled ? "DELETE" : "POST";
    const response = await fetch(`${API_URL}/sessions/${managingSessionId}/students/${studentId}`, { method, headers });
    if (response.ok) openEnrollments(managingSessionId);
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

      <div className="tab-container">
        <div className="tab-buttons">
          <button 
            className={`tab-button ${activeTab === "users" ? "active" : ""}`} 
            onClick={() => setActiveTab("users")}
          >
            User Management
          </button>
          <button 
            className={`tab-button ${activeTab === "sessions" ? "active" : ""}`} 
            onClick={() => setActiveTab("sessions")}
          >
            Session Management
          </button>
        </div>

        <div className="tab-content">
          {activeTab === "users" && (
            <div>
              {pendingUsers.length > 0 && (
                <div style={{ marginBottom: "40px" }}>
                  <h3 style={{ textTransform: "uppercase", borderBottom: "2px solid var(--border-heavy)", paddingBottom: "10px" }}>
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

              <div style={{ marginBottom: "40px" }}>
                <h3 style={{ textTransform: "uppercase", borderBottom: "2px solid var(--border-heavy)", paddingBottom: "10px" }}>
                  USER DIRECTORY ({users.length})
                </h3>
                <div className="dashboard-grid" style={{ marginTop: "20px" }}>
                  {users.map(u => (
                    <div key={u.id} className="swiss-card">
                      <h4>{u.username}</h4>
                      <div className="meta">ROLE: {u.role} | ID: #{u.id} | APPROVED: {u.is_approved ? "YES" : "NO"}</div>
                      <div className="actions" style={{ borderTop: "none", marginTop: "10px" }}>
                        <button onClick={() => changePassword(u.id)} className="swiss-btn warning">PWD</button>
                        <button onClick={() => deleteUser(u.id)} className="swiss-btn danger">DEL</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "sessions" && (
            <div>
              <h3 style={{ textTransform: "uppercase", borderBottom: "2px solid var(--border-heavy)", paddingBottom: "10px" }}>
                ALL SESSIONS ({sessions.length})
              </h3>
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
                    <button onClick={() => openEnrollments(s.id)} className="swiss-btn">ENROLL</button>
                    <button onClick={() => deleteSession(s.id)} className="swiss-btn danger">DEL</button>
                  </div>

                  {managingSessionId === s.id && (
                    <div style={{ marginTop: "20px", border: "2px solid var(--border-heavy)", padding: "10px", background: "#f8f9fa" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <h4 style={{ margin: 0, fontSize: "0.9rem" }}>MANAGE ENROLLMENTS</h4>
                        <button onClick={closeEnrollments} className="swiss-btn outline" style={{ padding: "2px 8px", fontSize: "0.8rem" }}>X</button>
                      </div>
                      <div style={{ maxHeight: "300px", overflowY: "auto", paddingRight: "10px" }}>
                        <div style={{ marginBottom: "20px" }}>
                          <h5 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "var(--accent-red)" }}>ALREADY ENROLLED</h5>
                          {allStudents.filter(st => sessionEnrollments.includes(st.id)).length === 0 && <span style={{fontSize:"0.8rem", color:"gray"}}>No students enrolled.</span>}
                          {allStudents.filter(st => sessionEnrollments.includes(st.id)).map(student => (
                            <div key={student.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccc", padding: "6px 0", fontSize: "0.9rem" }}>
                              <span>{student.name} ({student.roll_no})</span>
                              <button onClick={() => toggleStudent(student.id, true)} className="swiss-btn danger" style={{ padding: "3px 8px", fontSize: "0.7rem", height: "auto", minWidth: "auto" }}>REMOVE</button>
                            </div>
                          ))}
                        </div>
                        <div>
                          <h5 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "var(--text-main)" }}>AVAILABLE STUDENTS</h5>
                          {allStudents.filter(st => !sessionEnrollments.includes(st.id)).length === 0 && <span style={{fontSize:"0.8rem", color:"gray"}}>All students are enrolled.</span>}
                          {allStudents.filter(st => !sessionEnrollments.includes(st.id)).map(student => (
                            <div key={student.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccc", padding: "6px 0", fontSize: "0.9rem" }}>
                              <span>{student.name} ({student.roll_no})</span>
                              <button onClick={() => toggleStudent(student.id, false)} className="swiss-btn" style={{ padding: "3px 8px", fontSize: "0.7rem", height: "auto", minWidth: "auto" }}>ADD</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function TeacherTab({ user }) {
  const [dbSessions, setDbSessions] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [allStudents, setAllStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [activeTab, setActiveTab] = useState("sessions");
  const [evaluatingSessions, setEvaluatingSessions] = useState([]);

  const headers = { "Authorization": `Bearer ${user.token}`, "Content-Type": "application/json" };

  const loadMySessions = async () => {
    const response = await fetch(`${API_URL}/sessions/`, { headers });
    if (response.ok) setDbSessions(await response.json());
  };

  const loadStudents = async () => {
    const response = await fetch(`${API_URL}/students`, { headers });
    if (response.ok) setAllStudents(await response.json());
  };

  useEffect(() => { loadMySessions(); loadStudents(); }, []);

  const createSession = async (e) => {
    e.preventDefault();
    const response = await fetch(`${API_URL}/sessions/`, {
      method: "POST", headers, body: JSON.stringify({ title: newTitle, description: newDesc, student_ids: selectedStudentIds }),
    });
    if (response.ok) {
      setNewTitle(""); setNewDesc(""); setSelectedStudentIds([]); loadMySessions();
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
    setEvaluatingSessions(prev => [...prev, sessionId]);
    const response = await fetch(`${API_URL}/sessions/${sessionId}/evaluate`, { method: "POST", headers });
    if (response.ok) {
      alert("EVALUATION TRIGGERED!");
      setTimeout(() => {
        setEvaluatingSessions(prev => prev.filter(id => id !== sessionId));
        loadMySessions();
      }, 2500); // Simulate evaluation delay
    } else {
      setEvaluatingSessions(prev => prev.filter(id => id !== sessionId));
      alert("Failed to trigger evaluation.");
    }
  };

  return (
    <div>
      <div className="tab-container">
        <div className="tab-buttons">
          <button 
            className={`tab-button ${activeTab === "sessions" ? "active" : ""}`} 
            onClick={() => setActiveTab("sessions")}
          >
            My Sessions
          </button>
          <button 
            className={`tab-button ${activeTab === "create" ? "active" : ""}`} 
            onClick={() => setActiveTab("create")}
          >
            Create New Session
          </button>
        </div>

        <div className="tab-content">
          {activeTab === "create" && (
            <div>
              <h3 style={{ textTransform: "uppercase", borderBottom: "2px solid var(--border-heavy)", paddingBottom: "10px", marginBottom: "20px" }}>CREATE NEW SESSION</h3>
              <form onSubmit={createSession} className="form-group" style={{ maxWidth: "600px" }}>
                <input placeholder="TITLE" value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="swiss-input" />
                <textarea placeholder="DESCRIPTION" value={newDesc} onChange={e => setNewDesc(e.target.value)} required className="swiss-input" rows="3" />
                
                <div style={{ margin: "15px 0", maxHeight: "200px", overflowY: "auto", border: "2px solid var(--border-heavy)", padding: "10px", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "0.9rem" }}>SELECT STUDENTS TO ENROLL</h4>
                  {allStudents.map(student => (
                    <label key={student.id} style={{ display: "block", marginBottom: "5px", cursor: "pointer", fontSize: "0.9rem" }}>
                      <input 
                        type="checkbox" 
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedStudentIds([...selectedStudentIds, student.id]);
                          else setSelectedStudentIds(selectedStudentIds.filter(id => id !== student.id));
                        }}
                        style={{ marginRight: "10px" }}
                      />
                      {student.name} ({student.roll_no})
                    </label>
                  ))}
                </div>

                <button type="submit" className="swiss-btn" style={{ width: "fit-content" }}>DEPLOY SESSION</button>
              </form>
            </div>
          )}

          {activeTab === "sessions" && (
            <div>
              <h3 style={{ textTransform: "uppercase", borderBottom: "2px solid var(--border-heavy)", paddingBottom: "10px", marginBottom: "20px" }}>ACTIVE SESSIONS</h3>
        
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
                    
                    {evaluatingSessions.includes(s.id) ? (
                      <div className="status-badge pending" style={{ borderColor: "var(--accent-blue)", color: "var(--accent-blue)", borderStyle: "solid" }}>
                        EVALUATION IN PROGRESS...
                      </div>
                    ) : evalData ? (
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
          )}
        </div>
      </div>
    </div>
  );
}


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
      <div className="swiss-banner">
        <div>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "5px" }}>PARENT TERMINAL</h2>
          {user.student_name && <div style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--text-secondary)" }}>STUDENT: {user.student_name.toUpperCase()} (ROLL: {user.student_roll})</div>}
        </div>
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