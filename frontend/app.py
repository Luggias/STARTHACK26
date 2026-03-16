import streamlit as st
import requests
import pandas as pd
import json

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

    col1, col2 = st.columns(2)

    with col1:
        try:
            res = requests.get(f"{API_URL}/")
            if res.status_code == 200:
                st.success("Backend connected ✓")
        except Exception:
            st.error("Backend not reachable — is uvicorn running?")

    with col2:
        st.link_button("API Docs →", f"{API_URL}/docs")

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
    
    table = st.text_input("Table name", placeholder="e.g. users")

    if st.button("Fetch") and table:
        res = requests.get(f"{API_URL}/data/{table}")
        if res.status_code == 200:
            rows = res.json()
            if rows:
                df = pd.DataFrame(rows)
                st.dataframe(df)
                numeric_cols = df.select_dtypes("number").columns.tolist()
                if numeric_cols:
                    st.line_chart(df[numeric_cols])
            else:
                st.info("Table is empty.")
        else:
            st.error(res.json().get("detail", "Error fetching data"))

    with st.expander("Add row"):
        raw = st.text_area("JSON", placeholder='{"name": "Alice", "city": "Zurich"}')
        if st.button("Insert") and table and raw:
            try:
                row = json.loads(raw)
                res = requests.post(f"{API_URL}/data/{table}", json=row)
                if res.status_code == 200:
                    st.success(f"Inserted: {res.json()}")
                else:
                    st.error(res.json().get("detail", "Insert failed"))
            except json.JSONDecodeError:
                st.error("Invalid JSON")