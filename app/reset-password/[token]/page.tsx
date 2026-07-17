import ResetForm from "./ResetForm";

export const metadata = { title: "Choose New Password — The Heat Chart" };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="tag text-volt">Almost there</p>
      <h1 className="display mt-2 text-4xl text-white">New Password</h1>
      <div className="mt-6">
        <ResetForm token={token} />
      </div>
    </div>
  );
}
