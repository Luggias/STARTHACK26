# 🏗️ Master Project Template (HFT & Data Science)

This is a reusable GitHub Template Repository for public projects such as high-performance trading systems and data science projects. It comes pre-configured with security defaults, AI agent instructions, and a hybrid Python/Java environment setup.

> [!TIP]
> **To use this template:** Click the green **"Use this template"** button above to create a new repository based on this structure.

---

## 📂 Included Components

### 🛡️ Governance & Security (`.github/`)
* **`CONTRIBUTING.md` & `CODE_OF_CONDUCT.md`**: Standard guidelines for community or team collaboration.
* **`SECURITY.md`**: Procedures for reporting vulnerabilities (crucial for HFT).
* **`PULL_REQUEST_TEMPLATE.md`**: Ensures consistent code reviews.

### 🤖 AI-Agent Integration
* **`AGENTS.md`**: Contains extensive personas and rules for AI assistants (like Cursor, Copilot, or ChatGPT). Use this to give your AI tools immediate context about your HFT logic and coding standards.

### 📜 Licensing
* **`LICENSE`**: Licensed under **Apache License 2.0**. This allows for commercial use, modification, and distribution while providing an explicit grant of patent rights.

### ⚙️ Environment
* **`.gitignore`**: Optimized for:
    * **HFT**: Ignores binary tick data, logs, and database files.
    * **Data Science**: Ignores Jupyter checkpoints, large datasets (CSV, Parquet), and models.
    * **Security**: Automatically blocks `.env*`, `*.key`, and `*.pem` across all subdirectories.

---

## 🚀 Post-Creation Checklist
After creating a new repository from this template, follow these steps:

1. **Brand the Project**: Update the main `# [Project Name]` in this README.
2. **Customize Agents**: Adjust AGENTS.md if the new project requires specific domain knowledge (e.g., specific exchange APIs or ML models).
3. **Update License**: Ensure the copyright notice in the Apache License header (if applicable) reflects the current year.
4. **Setup Secrets**: 
   ```bash
   cp .env.example .env
   # Add your exchange API keys to .env (ignored by git)