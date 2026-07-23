import { storageDiagnostics } from "@/lib/storageDiag";

/**
 * Admin-only X-ray of where uploads live and whether they actually exist.
 * Async server component — reads the DB (+ filesystem) at render.
 */
export default async function StorageHealthPanel() {
  const d = await storageDiagnostics().catch(() => null);
  if (!d) return null;

  const missing = d.dbCheck.missingOnDisk;
  const filesGone = (d.driver === "db" || d.driver === "local") && missing > 0;
  const alarm = filesGone;

  const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1) + " MB";

  const Row = ({ k, v, bad }: { k: string; v: string; bad?: boolean }) => (
    <div className="flex justify-between gap-4 border-t border-edge/60 py-1.5 text-sm">
      <span className="text-smoke">{k}</span>
      <span className={`text-right font-mono ${bad ? "text-heat" : "text-white"}`}>{v}</span>
    </div>
  );

  const driverLabel =
    d.driver === "s3"
      ? "S3 object storage"
      : d.driver === "db"
        ? "Postgres (persists across redeploys)"
        : "Local disk";

  return (
    <div className={`rounded-xl border p-5 ${alarm ? "border-heat bg-heat/5" : "border-edge bg-surface"}`}>
      <p className={`tag ${alarm ? "text-heat" : "text-volt"}`}>
        Upload storage {alarm ? "· ⚠ needs attention" : "· healthy"}
      </p>

      <div className="mt-3">
        <Row k="Driver" v={driverLabel} />
        {d.driver === "s3" && d.s3 && (
          <>
            <Row k="Bucket" v={d.s3.bucket || "—"} />
            <Row k="Public URL" v={d.s3.publicUrl || "—"} bad={!d.s3.publicUrl} />
            <Row k="Endpoint" v={d.s3.endpoint || "(AWS default)"} />
          </>
        )}
        {d.driver === "db" && d.db && (
          <>
            <Row k="Files stored in Postgres" v={String(d.db.count)} />
            <Row k="Total bytes held" v={mb(d.db.totalBytes)} />
            {d.local && d.local.fileCount > 0 && (
              <Row k="Legacy files still on disk" v={String(d.local.fileCount)} />
            )}
          </>
        )}
        {d.driver === "local" && d.local && (
          <>
            <Row k="Upload dir" v={d.local.dir} />
            <Row k="Dir exists" v={d.local.exists ? "yes" : "NO"} bad={!d.local.exists} />
            <Row k="Writable" v={d.local.writable ? "yes" : "NO"} bad={!d.local.writable} />
            <Row k="Files on disk" v={String(d.local.fileCount)} bad={d.local.fileCount === 0} />
          </>
        )}
        <Row k="Record URLs checked" v={String(d.dbCheck.checked)} />
        <Row
          k="Upload URLs → bytes present"
          v={`${d.dbCheck.presentOnDisk} / ${d.dbCheck.localUrls}`}
          bad={missing > 0}
        />
        {missing > 0 && <Row k="Upload URLs → MISSING bytes" v={String(missing)} bad />}
        {d.dbCheck.s3Urls > 0 && <Row k="Records pointing at S3/http" v={String(d.dbCheck.s3Urls)} />}
      </div>

      {filesGone && (
        <p className="mt-3 rounded border border-heat/50 bg-heat/10 px-3 py-2 text-sm text-heat">
          {missing} record{missing === 1 ? "" : "s"} point at an upload whose bytes aren&apos;t
          stored (not in Postgres, not on disk). Those were uploaded before this fix, while the
          disk volume was wiping on every redeploy — they&apos;re unrecoverable and need to be
          re-uploaded. Every upload from now on is stored in Postgres and persists.
        </p>
      )}
      {d.driver === "db" && !alarm && (
        <p className="mt-3 text-xs text-smoke">
          Uploads are stored in Postgres and survive every redeploy. No disk volume required.
        </p>
      )}

      {d.dbCheck.presentSample && (
        <div className="mt-3 border-t border-edge/60 pt-3">
          <p className="tag text-smoke">Live serving test (a real uploaded file):</p>
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={d.dbCheck.presentSample}
              alt="serving test"
              className="h-16 w-16 rounded border border-edge bg-panel object-cover"
            />
            <span className="min-w-0 break-all font-mono text-xs text-smoke">
              {d.dbCheck.presentSample}
              <br />
              If this thumbnail is blank, the serving route is the problem, not storage.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
