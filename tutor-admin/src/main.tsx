import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { AuthProvider } from "./app/AuthContext";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import "./styles.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false }, mutations: { retry: false } } });
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><AppErrorBoundary><QueryClientProvider client={queryClient}><AuthProvider><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></BrowserRouter></AuthProvider></QueryClientProvider></AppErrorBoundary></React.StrictMode>);
