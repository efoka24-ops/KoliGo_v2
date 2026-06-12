# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: koligo-comprehensive.spec.js >> 03 — Connexion + Accueil Vendeur >> Connexion FOKA → Accueil Vendeur visible
- Location: tests\koligo-comprehensive.spec.js:199:3

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

```
Tearing down "context" exceeded the test timeout of 90000ms.
```

# Page snapshot

```yaml
- generic [ref=e12]:
  - generic [ref=e16]: Connexion
  - generic [ref=e17]: Numéro de téléphone ou adresse email
  - textbox "6XX XX XX XX ou email" [ref=e19]
  - generic [ref=e20]: Continuer →
  - generic [ref=e22] [cursor=pointer]: Pas encore de compte ? Créer un compte
```