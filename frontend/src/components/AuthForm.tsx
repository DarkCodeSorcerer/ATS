import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import toast from "react-hot-toast";

const titles = {
  login: { heading: "Welcome back", cta: "Login", helper: "New here?", link: "Create account", linkTo: "/signup" },
  signup: { heading: "Create your account", cta: "Sign up", helper: "Already have an account?", link: "Login", linkTo: "/login" }
};

export const AuthForm: React.FC<{ mode: "login" | "signup" }> = ({ mode }) => {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const copy = titles[mode];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Logged in");
      } else {
        await signup(email, password);
        toast.success("Account created");
      }
      navigate("/resume-match");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-5 bg-white/80 backdrop-blur p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/60" onSubmit={submit}>
      <div className="space-y-1">
        <p className="text-sm text-slate-500">{mode === "login" ? "Sign in to access your TalentFlow dashboard" : "Start tracking your applications"}</p>
        <h2 className="text-2xl font-semibold text-slate-900">{copy.heading}</h2>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-700" htmlFor="email">Email</label>
        <input
          id="email"
          className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 p-3 rounded-lg transition"
          placeholder="you@example.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-700" htmlFor="password">Password</label>
        <input
          id="password"
          className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 p-3 rounded-lg transition"
          placeholder="Minimum 8 characters"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>

      <button
        className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-3 rounded-lg font-semibold shadow-lg hover:from-indigo-500 hover:to-blue-500 transition disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Please wait..." : copy.cta}
      </button>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{copy.helper}</span>
        <Link className="text-indigo-600 font-semibold hover:underline" to={copy.linkTo}>
          {copy.link}
        </Link>
      </div>
    </form>
  );
};

