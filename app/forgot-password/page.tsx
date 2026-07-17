import ForgotForm from "./ForgotForm";

export const metadata = { title: "Reset Password — Designer Kicks" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="tag text-volt">No stress</p>
      <h1 className="display mt-2 text-4xl text-white">Reset Password</h1>
      <p className="mt-2 text-sm text-smoke">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <div className="mt-6">
        <ForgotForm />
      </div>
    </div>
  );
}
