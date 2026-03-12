import streamlit as st
import requests

API_URL = "http://localhost:8000"

st.set_page_config(page_title="Cache Me If You Can", page_icon="🏆", layout="wide")

st.title("🏆 Cache Me If You Can")
st.caption("START Hack 2026")

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("Navigation")
    page = st.radio("", ["Home", "AI Chat", "Data"])

# ── Pages ─────────────────────────────────────────────────────────────────────

if page == "Home":
    st.header("Welcome")
    st.write("Replace this with your project's main view.")

    # Quick API health check
    try:
        res = requests.get(f"{API_URL}/")
        if res.status_code == 200:
            st.success("Backend connected ✓")
    except Exception:
        st.error("Backend not reachable — is uvicorn running?")

elif page == "AI Chat":
    st.header("AI Chat")

    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Display chat history
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])

    # Input
    if prompt := st.chat_input("Ask something..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.write(prompt)

        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                try:
                    res = requests.post(f"{API_URL}/ai/chat", json={"message": prompt})
                    reply = res.json()["reply"]
                except Exception as e:
                    reply = f"Error: {e}"
            st.write(reply)
            st.session_state.messages.append({"role": "assistant", "content": reply})

elif page == "Data":
    st.header("Data")
    st.write("Add your charts and data tables here.")
    # Example: st.line_chart(your_dataframe)
