import { storageDiagnostics } from "@/lib/storageDiag";

/**
 * Admin-only X-ray of where uploads live and whether they actually exist.
 * Async server component — reads the filesystem + DB at render.
 */
export default async function StorageHealthPanel() {
  const d = await storageDiagnostics().catch(() => null);
  if (!d) return null;

  const missing = d.dbCheck.missingOnDisk;
  const filesGone = d.driver === "local" && missing > 0;
  const noFiles = d.driver === "local" && d.local?.exists && d.local.fileCount === 0;
  const alarm = filesGone || noFiles || (d.driver === "local" && !d.local?.writable);

  const Row = ({ k, v, bad }: { k: string; v: string; bad?: boolean }) => (
    <div className="flex justify-between gap-4 border-t border-edge/60 py-1.5 text-sm">
      <span className="text-smoke">{k}</span>
      <span className={`text-right font-mono ${bad ? "text-heat" : "text-white"}`}>{v}</span>
    </div>
  );

  return (
    <div className={`rounded-xl border p-5 ${alarm ? "border-heat bg-heat/5" : "border-edge bg-surface"}`}>
      <p className={`tag ${alarm ? "text-heat" : "text-volt"}`}>
        Upload storage {alarm ? "· ⚠ needs attention" : "· healthy"}
      </p>

      <div className="mt-3">
        <Row k="Driver" v={d.driver === "s3" ? "S3 object storage" : "Local disk / volume"} />
        {d.driver === "s3" && d.s3 && (
          <>
            <Row k="Bucket" v={d.s3.bucket || "—"} />
            <Row k="Public URL" v={d.s3.publicUrl || "—"} bad={!d.s3.publicUrl} />
            <Row k="Endpoint" v={d.s3.endpoint || "(AWS default)"} />
          </>
        )}
        {d.driver === "local" && d.local && (
          <>
            <Row k="Upload dir" v={d.local.dir} />
            <Row k="Process cwd" v={d.local.cwd} />
            <Row k="UPLOAD_DIR env" v={d.local.uploadDirEnv || "(unset — using cwd/data/uploads)"} bad={!d.local.uploadDirEnv} />
            <Row k="Dir exists" v={d.local.exists ? "yes" : "NO"} bad={!d.local.exists} />
            <Row k="Writable" v={d.local.writable ? "yes" : "NO"} bad={!d.local.writable} />
            <Row k="Files on disk" v={String(d.local.fileCount)} bad={d.local.fileCount === 0} />
          </>
        )}
        <Row k="Record URLs checked" v={String(d.dbCheck.checked)} />
        <Row
          k="Local URLs → file present"
          v={`${d.dbCheck.presentOnDisk} / ${d.dbCheck.localUrls}`}
          bad={missing > 0}
        />
        {missing > 0 && <Row k="Local URLs → MISSING file" v={String(missing)} bad />}
        {d.dbCheck.s3Urls > 0 && <Row k="Records pointing at S3/http" v={String(d.dbCheck.s3Urls)} />}
      </div>

      {filesGone && (
        <p className="mt-3 rounded border border-heat/50 bg-heat/10 px-3 py-2 text-sm text-heat">
          {missing} record{missing === 1 ? "" : "s"} point at a photo file that isn&apos;t on
          disk. The persistent volume isn&apos;t holding uploads (or points at the wrong path),
          so every redeploy wipes them. Set <span className="font-mono">UPLOAD_DIR</span> to the
          mounted volume path (e.g. <span className="font-mono">/app/data/uploads</span>) and
          confirm a volume is mounted at <span className="font-mono">/app/data</span> — or switch
          to S3 object storage so files never live on the container.
        </p>
      )}
      {noFiles && !filesGone && (
        <p className="mt-3 rounded border border-heat/50 bg-heat/10 px-3 py-2 text-sm text-heat">
          The upload directory is empty — every uploaded photo is gone. If uploads previously
          worked, the volume isn&apos;t persisting across deploys. Pin{" "}
          <span className="font-mono">UPLOAD_DIR</span> to the mounted volume, or move to S3.
        </p>
      )}
      {d.driver === "local" && !alarm && (
        <p className="mt-3 text-xs text-smoke">
          Files resolve on disk. If photos still don&apos;t show, it&apos;s format (run &ldquo;Fix
          photos now&rdquo;) — not storage.
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
