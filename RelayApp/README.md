# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## Firebase local configuration

For Firebase live sync, create a `.env.local` file in the project root and set:

```env
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_DB_URL=your_realtime_database_url
```

Restart the Vite dev server after changing environment variables. Without these
values, the app runs in local demo mode. Do not put private server credentials
or service-account keys in Vite environment variables; values prefixed with
`VITE_` are included in the browser app.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
