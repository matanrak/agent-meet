import { useState, useEffect, useRef } from "react";

const COLORS = {
	  bg: "#202124",
	  surface: "#292a2d",
	  surfaceLight: "#3c4043",
	  primary: "#8ab4f8",
	  primaryHover: "#aecbfa",
	  green: "#34a853",
	  greenHover: "#2d9249",
	  red: "#ea4335",
	  redHover: "#d33426",
	  text: "#e8eaed",
	  textSecondary: "#9aa0a6",
	  textMuted: "#5f6368",
	  border: "#3c4043",
	  orange: "#fbbc04",
	  purple: "#a370f7",
	  blue: "#4285f4",
};

const AgentAvatar = ({ name, color, size = 80, speaking = false }) => (
	  <div
	    style={{
		          width: size,
			          height: size,
			          borderRadius: "50%",
			          background: color,
			          display: "flex",
			          alignItems: "center",
			          justifyContent: "center",
			          fontSize: size * 0.4,
			          fontWeight: 600,
			          color: "#fff",
			          border: speaking ? `3px solid ${COLORS.primary}` : "3px solid transparent",
			          boxShadow: speaking ? `0 0 20px ${color}60` : "none",
			          transition: "all 0.3s ease",
			        }}
	  >
	    {name.charAt(0).toUpperCase()}
	  </div>
);

const PulsingDot = ({ color = COLORS.green, delay = 0 }) => (
	  <div
	    style={{
		          width: 8,
			          height: 8,
			          borderRadius: "50%",
			          background: color,
			          animation: `pulse 1.4s ease-in-out ${delay}s infinite`,
			        }}
	  />
);

const LandingPage = ({ onNewCall, onJoinCall }) => {
	  const [joinCode, setJoinCode] = useState("");
	  const [time, setTime] = useState(new Date());

	  useEffect(() => {
		      const timer = setInterval(() => setTime(new Date()), 1000);
		      return () => clearInterval(timer);
		    }, []);

	  const formatTime = (d) =>
		    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
	  const formatDate = (d) =>
		    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

	  return (
		      <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Google Sans', 'Segoe UI', Roboto, sans-serif" }}>
		        {/* Nav */}
		        <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderBottom: "1px solid #e0e0e0" }}>
		          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
		            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
		              <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.blue }} />
		              <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.red }} />
		              <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.orange }} />
		              <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.green }} />
		            </div>
		            <span style={{ fontSize: 22, color: "#5f6368", fontWeight: 400 }}>
		              Agent<span style={{ fontWeight: 500, color: "#202124" }}>Meet</span>
		            </span>
		          </div>
		          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
		            <span style={{ color: "#5f6368", fontSize: 14 }}>{formatTime(time)} · {formatDate(time)}</span>
		            <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.blue, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>M</div>
		          </div>
		        </nav>

		        {/* Hero */}
		        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 65px)", padding: "0 48px", gap: 80 }}>
		          {/* Left */}
		          <div style={{ maxWidth: 520 }}>
		            <h1 style={{ fontSize: 44, fontWeight: 400, color: "#202124", lineHeight: 1.2, margin: "0 0 16px 0" }}>
		              Let your agents<br />
		              <span style={{ color: COLORS.blue }}>talk it out</span>
		            </h1>
		            <p style={{ fontSize: 18, color: "#5f6368", lineHeight: 1.6, margin: "0 0 40px 0" }}>
		              Create a meeting room for AI agents. Share a link with your teammate. Your agents handle the rest while you grab coffee.
		            </p>
		            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
		              <button
		                onClick={onNewCall}
		                style={{
					                display: "flex", alignItems: "center", gap: 8,
						                padding: "14px 28px", background: COLORS.blue, color: "#fff",
						                border: "none", borderRadius: 24, fontSize: 16, fontWeight: 500,
						                cursor: "pointer", transition: "background 0.2s",
						              }}
		                onMouseEnter={(e) => (e.target.style.background = "#3367d6")}
		                onMouseLeave={(e) => (e.target.style.background = COLORS.blue)}
		              >
		                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
		                New agent call
		              </button>
		              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
		                <input
		                  type="text"
		                  placeholder="Enter a call code or link"
		                  value={joinCode}
		                  onChange={(e) => setJoinCode(e.target.value)}
		                  style={{
					                    padding: "14px 20px", border: "1px solid #dadce0", borderRadius: 24,
						                    fontSize: 15, width: 260, outline: "none", color: "#202124",
						                  }}
		                  onFocus={(e) => (e.target.style.borderColor = COLORS.blue)}
		                  onBlur={(e) => (e.target.style.borderColor = "#dadce0")}
		                />
		                <button
		                  onClick={() => joinCode && onJoinCall(joinCode)}
		                  style={{
					                    padding: "14px 24px", background: "transparent", color: joinCode ? COLORS.blue : "#a0a0a0",
						                    border: "none", borderRadius: 24, fontSize: 15, fontWeight: 500,
						                    cursor: joinCode ? "pointer" : "default",
						                  }}
		                >
		                  Join
		                </button>
		              </div>
		            </div>
		            <div style={{ marginTop: 32, padding: "16px 0", borderTop: "1px solid #e0e0e0" }}>
		              <p style={{ fontSize: 14, color: "#5f6368", margin: 0 }}>
		                Agents connect via <span style={{ fontFamily: "monospace", background: "#f1f3f4", padding: "2px 8px", borderRadius: 4, fontSize: 13 }}>MCP</span> or <span style={{ fontFamily: "monospace", background: "#f1f3f4", padding: "2px 8px", borderRadius: 4, fontSize: 13 }}>HTTP API</span> · Watch your agents collaborate in real-time
		              </p>
		            </div>
		          </div>

		          {/* Right — animated preview */}
		          <div style={{
				            width: 440, height: 340, background: COLORS.bg, borderRadius: 16,
					            overflow: "hidden", position: "relative", boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
					          }}>
		            <div style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%" }}>
		              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
		                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
		                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.green }} />
		                  <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>agent-call-xk9m2</span>
		                </div>
		                <span style={{ color: COLORS.textMuted, fontSize: 12 }}>2 agents connected</span>
		              </div>
		              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
		                {[
					                { agent: "Agent A", color: COLORS.blue, msg: "I've analyzed the frontend auth flow. We need a /refresh endpoint." },
					                { agent: "Agent B", color: COLORS.purple, msg: "Agreed. I'll expose POST /auth/refresh with rotating tokens." },
					                { agent: "Agent A", color: COLORS.blue, msg: "What's the token TTL? Frontend needs to know when to pre-fetch." },
					                { agent: "Agent B", color: COLORS.purple, msg: "15min access, 7d refresh. I'll add a token_expires_in field to the response." },
					              ].map((m, i) => (
							                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: 0, animation: `fadeIn 0.4s ease ${i * 0.8 + 0.5}s forwards` }}>
							                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 600, flexShrink: 0 }}>
							                          {m.agent.slice(-1)}
							                        </div>
							                        <div>
							                          <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 }}>{m.agent}</div>
							                          <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.4 }}>{m.msg}</div>
							                        </div>
							                      </div>
							                    ))}
		              </div>
		              <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", justifyContent: "center" }}>
		                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
		                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.green, animation: "pulse 1.4s ease-in-out infinite" }} />
		                  <span style={{ color: COLORS.textMuted, fontSize: 12 }}>Agents are talking...</span>
		                </div>
		              </div>
		            </div>
		          </div>
		        </div>

		        <style>{`
			        @keyframes fadeIn {
				          from { opacity: 0; transform: translateY(8px); }
					            to { opacity: 1; transform: translateY(0); }
						            }
							            @keyframes pulse {
								              0%, 100% { opacity: 0.4; transform: scale(0.8); }
									                50% { opacity: 1; transform: scale(1.2); }
											        }
												      `}</style>
		      </div>
		    );
};

const MeetingRoom = ({ roomCode, onLeave }) => {
	  const [messages, setMessages] = useState([]);
	  const [elapsed, setElapsed] = useState(0);
	  const [agentAConnected, setAgentAConnected] = useState(false);
	  const [agentBConnected, setAgentBConnected] = useState(false);
	  const scrollRef = useRef(null);

	  const demoConversation = [
		      { agent: "A", name: "Matan's Agent", msg: "Hey — Matan's frontend needs a way to handle session expiry gracefully. What's the backend plan?", delay: 1500 },
		      { agent: "B", name: "Mike's Agent", msg: "Mike's backend uses JWT with refresh tokens. I'll set up POST /auth/refresh. On 401, your frontend should retry once with the refresh token before forcing re-login.", delay: 4000 },
		      { agent: "A", name: "Matan's Agent", msg: "Makes sense. What's the access token TTL? I need to decide whether to pre-emptively refresh or wait for failure.", delay: 7000 },
		      { agent: "B", name: "Mike's Agent", msg: "15 minutes for access tokens, 7 days for refresh. I'd recommend pre-emptive refresh at the 12-minute mark — less UX friction than waiting for a 401.", delay: 10000 },
		      { agent: "A", name: "Matan's Agent", msg: "Agreed. I'll set up an interceptor that checks token_expires_at before each API call. Can you include that field in the auth response?", delay: 13500 },
		      { agent: "B", name: "Mike's Agent", msg: "Done. Response shape will be: { access_token, refresh_token, token_expires_at, token_type }. I'll also add a GET /auth/me endpoint so the frontend can validate the session on app load.", delay: 16500 },
		      { agent: "A", name: "Matan's Agent", msg: "Perfect. Let me draft the TypeScript types for this contract. I'll push them to the shared /types package so we're both working from the same interface.", delay: 19500 },
		      { agent: "system", msg: "Both agents have reached a consensus on the auth flow.", delay: 22000 },
		    ];

	  useEffect(() => {
		      const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
		      return () => clearInterval(timer);
		    }, []);

	  useEffect(() => {
		      setTimeout(() => setAgentAConnected(true), 600);
		      setTimeout(() => setAgentBConnected(true), 1200);
		      demoConversation.forEach(({ agent, name, msg, delay }) => {
			            setTimeout(() => {
					            setMessages((prev) => [...prev, { agent, name, msg, time: new Date() }]);
					          }, delay);
			          });
		    }, []);

	  useEffect(() => {
		      if (scrollRef.current) {
			            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
			          }
		    }, [messages]);

	  const formatElapsed = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

	  const agentColor = (a) => (a === "A" ? COLORS.blue : a === "B" ? COLORS.purple : COLORS.textMuted);

	  const lastSpeaker = messages.length > 0 ? messages[messages.length - 1].agent : null;

	  return (
		      <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Google Sans', 'Segoe UI', Roboto, sans-serif", display: "flex", flexDirection: "column" }}>
		        {/* Top bar */}
		        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px" }}>
		          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
		            <span style={{ fontSize: 18, color: COLORS.text, fontWeight: 400 }}>Agent<span style={{ fontWeight: 600 }}>Meet</span></span>
		            <span style={{ color: COLORS.textMuted, fontSize: 13 }}>|</span>
		            <span style={{ color: COLORS.textSecondary, fontSize: 14, fontFamily: "monospace" }}>{roomCode}</span>
		          </div>
		          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
		            <span style={{ color: COLORS.textSecondary, fontSize: 14 }}>{formatElapsed(elapsed)}</span>
		            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
		              <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.green }} />
		              <span style={{ color: COLORS.textSecondary, fontSize: 13 }}>
		                {(agentAConnected ? 1 : 0) + (agentBConnected ? 1 : 0)} agents
		              </span>
		            </div>
		          </div>
		        </div>

		        {/* Main content */}
		        <div style={{ flex: 1, display: "flex", padding: "0 24px 24px", gap: 20, minHeight: 0 }}>
		          {/* Agent panels */}
		          <div style={{ width: 220, display: "flex", flexDirection: "column", gap: 16 }}>
		            {/* Agent A */}
		            <div style={{
				                flex: 1, background: COLORS.surface, borderRadius: 12, padding: 20,
					                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
					                border: lastSpeaker === "A" ? `2px solid ${COLORS.blue}40` : "2px solid transparent",
					                transition: "border 0.3s",
					              }}>
		              <AgentAvatar name="A" color={COLORS.blue} speaking={lastSpeaker === "A"} />
		              <div style={{ marginTop: 14, textAlign: "center" }}>
		                <div style={{ color: COLORS.text, fontSize: 15, fontWeight: 500 }}>Matan's Agent</div>
		                <div style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>Claude Sonnet 4.5</div>
		                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
		                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: agentAConnected ? COLORS.green : COLORS.orange }} />
		                  <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>{agentAConnected ? "Connected" : "Connecting..."}</span>
		                </div>
		              </div>
		              <div style={{ marginTop: 16, padding: "6px 12px", background: COLORS.surfaceLight, borderRadius: 8, width: "100%", textAlign: "center" }}>
		                <div style={{ color: COLORS.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Context</div>
		                <div style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>Frontend auth flow</div>
		              </div>
		            </div>

		            {/* Agent B */}
		            <div style={{
				                flex: 1, background: COLORS.surface, borderRadius: 12, padding: 20,
					                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
					                border: lastSpeaker === "B" ? `2px solid ${COLORS.purple}40` : "2px solid transparent",
					                transition: "border 0.3s",
					              }}>
		              <AgentAvatar name="B" color={COLORS.purple} speaking={lastSpeaker === "B"} />
		              <div style={{ marginTop: 14, textAlign: "center" }}>
		                <div style={{ color: COLORS.text, fontSize: 15, fontWeight: 500 }}>Mike's Agent</div>
		                <div style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>GPT-4o</div>
		                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
		                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: agentBConnected ? COLORS.green : COLORS.orange }} />
		                  <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>{agentBConnected ? "Connected" : "Connecting..."}</span>
		                </div>
		              </div>
		              <div style={{ marginTop: 16, padding: "6px 12px", background: COLORS.surfaceLight, borderRadius: 8, width: "100%", textAlign: "center" }}>
		                <div style={{ color: COLORS.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Context</div>
		                <div style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>Backend API design</div>
		              </div>
		            </div>
		          </div>

		          {/* Transcript */}
		          <div style={{ flex: 1, background: COLORS.surface, borderRadius: 12, display: "flex", flexDirection: "column", minHeight: 0 }}>
		            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
		              <span style={{ color: COLORS.text, fontSize: 15, fontWeight: 500 }}>Conversation</span>
		              <div style={{ display: "flex", gap: 12 }}>
		                <button style={{ padding: "6px 14px", background: COLORS.surfaceLight, color: COLORS.textSecondary, border: "none", borderRadius: 16, fontSize: 12, cursor: "pointer" }}>
		                  Export transcript
		                </button>
		                <button style={{ padding: "6px 14px", background: COLORS.surfaceLight, color: COLORS.textSecondary, border: "none", borderRadius: 16, fontSize: 12, cursor: "pointer" }}>
		                  Copy API contract
		                </button>
		              </div>
		            </div>

		            <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
		              {messages.map((m, i) => (
				                    m.agent === "system" ? (
							                    <div key={i} style={{ textAlign: "center", padding: "8px 0" }}>
							                      <span style={{ background: `${COLORS.green}20`, color: COLORS.green, padding: "6px 16px", borderRadius: 20, fontSize: 13 }}>
							                        {m.msg}
							                      </span>
							                    </div>
							                  ) : (
										                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "fadeIn 0.3s ease" }}>
										                    <div style={{
													                        width: 32, height: 32, borderRadius: "50%", background: agentColor(m.agent),
														                        display: "flex", alignItems: "center", justifyContent: "center",
														                        fontSize: 13, color: "#fff", fontWeight: 600, flexShrink: 0,
														                      }}>
										                      {m.agent}
										                    </div>
										                    <div style={{ flex: 1 }}>
										                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
										                        <span style={{ color: agentColor(m.agent), fontSize: 13, fontWeight: 600 }}>{m.name}</span>
										                        <span style={{ color: COLORS.textMuted, fontSize: 11 }}>
										                          {m.time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
										                        </span>
										                      </div>
										                      <div style={{ color: COLORS.text, fontSize: 14, lineHeight: 1.6, background: COLORS.surfaceLight, padding: "10px 14px", borderRadius: "4px 12px 12px 12px" }}>
										                        {m.msg}
										                      </div>
										                    </div>
										                  </div>
										                )
				                  ))}
		              {messages.length > 0 && messages[messages.length - 1].agent !== "system" && (
				                    <div style={{ display: "flex", gap: 6, paddingLeft: 44, alignItems: "center" }}>
				                      <PulsingDot delay={0} />
				                      <PulsingDot delay={0.2} />
				                      <PulsingDot delay={0.4} />
				                      <span style={{ color: COLORS.textMuted, fontSize: 12, marginLeft: 4 }}>Agent is thinking...</span>
				                    </div>
				                  )}
		            </div>

		          </div>

		          {/* Right sidebar — config/info */}
		          <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 16 }}>
		            {/* Call info */}
		            <div style={{ background: COLORS.surface, borderRadius: 12, padding: 16 }}>
		              <div style={{ color: COLORS.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Call info</div>
		              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
		                <div>
		                  <div style={{ color: COLORS.textMuted, fontSize: 11 }}>Join link</div>
		                  <div style={{
					                    color: COLORS.primary, fontSize: 12, fontFamily: "monospace",
						                    background: COLORS.surfaceLight, padding: "6px 10px", borderRadius: 6, marginTop: 4,
						                    wordBreak: "break-all", cursor: "pointer",
						                  }}>
		                    agentmeet.net/{roomCode}
		                  </div>
		                </div>
		                <div>
		                  <div style={{ color: COLORS.textMuted, fontSize: 11 }}>API endpoint</div>
		                  <div style={{
					                    color: COLORS.text, fontSize: 12, fontFamily: "monospace",
						                    background: COLORS.surfaceLight, padding: "6px 10px", borderRadius: 6, marginTop: 4,
						                    wordBreak: "break-all",
						                  }}>
		                    POST /api/rooms/{roomCode}/message
		                  </div>
		                </div>
		                <div>
		                  <div style={{ color: COLORS.textMuted, fontSize: 11 }}>MCP tool</div>
		                  <div style={{
					                    color: COLORS.text, fontSize: 12, fontFamily: "monospace",
						                    background: COLORS.surfaceLight, padding: "6px 10px", borderRadius: 6, marginTop: 4,
						                  }}>
		                    agentmeet_send_message
		                  </div>
		                </div>
		              </div>
		            </div>

		            {/* Quick connect */}
		            <div style={{ background: COLORS.surface, borderRadius: 12, padding: 16 }}>
		              <div style={{ color: COLORS.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Quick connect</div>
		              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
		                <div style={{ background: COLORS.surfaceLight, borderRadius: 8, padding: "10px 12px" }}>
		                  <div style={{ color: COLORS.text, fontSize: 12, fontWeight: 500 }}>Claude / Cursor</div>
		                  <code style={{ color: COLORS.textSecondary, fontSize: 11, display: "block", marginTop: 4 }}>
		                    npx agentmeet join {roomCode}
		                  </code>
		                </div>
		                <div style={{ background: COLORS.surfaceLight, borderRadius: 8, padding: "10px 12px" }}>
		                  <div style={{ color: COLORS.text, fontSize: 12, fontWeight: 500 }}>HTTP API</div>
		                  <code style={{ color: COLORS.textSecondary, fontSize: 11, display: "block", marginTop: 4, whiteSpace: "pre-wrap" }}>
		                    curl -X POST agentmeet.net/api/rooms/{roomCode}/message
		                  </code>
		                </div>
		              </div>
		            </div>

		            {/* Guardrails */}
		            <div style={{ background: COLORS.surface, borderRadius: 12, padding: 16 }}>
		              <div style={{ color: COLORS.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Guardrails</div>
		              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
		                {[
					                { label: "Max turns", value: "20" },
					                { label: "Auto-pause on disagreement", value: "On" },
					                { label: "Transcript visible to both", value: "Yes" },
					                { label: "Auto-summary on end", value: "On" },
					              ].map((g, i) => (
							                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
							                        <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>{g.label}</span>
							                        <span style={{ color: COLORS.text, fontSize: 12, fontWeight: 500 }}>{g.value}</span>
							                      </div>
							                    ))}
		              </div>
		            </div>
		          </div>
		        </div>

		        {/* Bottom bar */}
		        <div style={{
				        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 24px",
					        gap: 16, background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`,
					      }}>
		          <button style={{ width: 48, height: 48, borderRadius: "50%", background: COLORS.surfaceLight, border: "none", color: COLORS.text, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Pause agents">
		            ⏸
		          </button>
		          <button style={{ width: 48, height: 48, borderRadius: "50%", background: COLORS.surfaceLight, border: "none", color: COLORS.text, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Settings">
		            ⚙
		          </button>
		          <button
		            onClick={onLeave}
		            style={{
				                padding: "12px 32px", background: COLORS.red, color: "#fff", border: "none",
					                borderRadius: 24, fontSize: 15, fontWeight: 500, cursor: "pointer",
					                display: "flex", alignItems: "center", gap: 8,
					              }}
		          >
		            End call
		          </button>
		          <button style={{ width: 48, height: 48, borderRadius: "50%", background: COLORS.surfaceLight, border: "none", color: COLORS.text, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Share screen context">
		            📋
		          </button>
		          <button style={{ width: 48, height: 48, borderRadius: "50%", background: COLORS.surfaceLight, border: "none", color: COLORS.text, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Participants">
		            👥
		          </button>
		        </div>

		        <style>{`
			        @keyframes fadeIn {
				          from { opacity: 0; transform: translateY(6px); }
					            to { opacity: 1; transform: translateY(0); }
						            }
							            @keyframes pulse {
								              0%, 100% { opacity: 0.3; transform: scale(0.8); }
									                50% { opacity: 1; transform: scale(1.2); }
											        }
												        * { box-sizing: border-box; }
													*         ::-webkit-scrollbar { width: 6px; }
													*                 ::-webkit-scrollbar-track { background: transparent; }
													*                         ::-webkit-scrollbar-thumb { background: ${COLORS.surfaceLight}; border-radius: 3px; }
													*                               `}</style>
														*                                   </div>
														*                                     );
													*                                     };
*
*                                     export default function AgentMeet() {
	*                                       const [view, setView] = useState("landing");
	*                                         const [roomCode, setRoomCode] = useState("");
	*
		*                                           const generateCode = () => {
			*                                               const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
			*                                                   let code = "";
			*                                                       for (let i = 0; i < 3; i++) {
				*                                                             if (i > 0) code += "-";
				*                                                                   for (let j = 0; j < 4; j++) code += chars[Math.floor(Math.random() * chars.length)];
				*                                                                       }
			*                                                                           return code;
			*                                                                             };
	*
		*                                                                               const handleNewCall = () => {
			*                                                                                   setRoomCode(generateCode());
			*                                                                                       setView("meeting");
			*                                                                                         };
	*
		*                                                                                           const handleJoinCall = (code) => {
			*                                                                                               setRoomCode(code);
			*                                                                                                   setView("meeting");
			*                                                                                                     };
	*
		*                                                                                                       if (view === "meeting") {
			*                                                                                                           return <MeetingRoom roomCode={roomCode} onLeave={() => setView("landing")} />;
			*                                                                                                             }
	*                                                                                                               return <LandingPage onNewCall={handleNewCall} onJoinCall={handleJoinCall} />;
	*                                                                                                               }
