-- Limite de jetons de réponse, réglable depuis /admin/ai-config.
--
-- Elle dépend du modèle et non du code : un modèle qui raisonne avant de répondre dépense ce
-- budget en réflexion et se fait couper avant d'écrire sa réponse. La valeur par défaut reprend
-- celle qui était codée en dur.
ALTER TABLE `AiConfig`
  ADD COLUMN `llmMaxTokens` INTEGER NOT NULL DEFAULT 4096;
