"use client";

import { useState, useSyncExternalStore } from "react";
import { EMPTY_DRAFT, STATUSES, addNote, countLiving, filterNotes, noteStore, removeNote, type Draft } from "@/lib/collaborations";

export default function Home() {
  const items = useSyncExternalStore(noteStore.subscribe, noteStore.getSnapshot, noteStore.getServerSnapshot);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const filtered = filterNotes(items, query);
  const addItem = () => {
    if (!draft.title.trim()) return;
    noteStore.update((current) => addNote(current, draft, crypto.randomUUID(), Date.now()));
    setDraft(EMPTY_DRAFT);
  };
  const openCount = countLiving(items);

  return (
    <main className="folio-shell">
      <header className="folio-header">
        <div className="folio-mark" aria-hidden="true"><span>✳</span><span>✿</span><span>✳</span></div>
        <div>
          <p className="folio-kicker">COLLABORATIONS / FIELD FOLIO</p>
          <h1>Grow the right work<br /><em>with the right people.</em></h1>
          <p className="folio-intro">A small, local notebook for ideas that want another set of hands. Keep the request, the context, and its living status in one place.</p>
        </div>
        <div className="folio-index"><span>PLATE</span><strong>06</strong><small>local / private</small></div>
      </header>

      <section className="folio-stage" aria-labelledby="stage-title">
        <div className="stem" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="stage-copy"><p className="section-label">CURRENT GARDEN</p><h2 id="stage-title">{openCount || "No"} living {openCount === 1 ? "thread" : "threads"}</h2><p>Each entry is a seed. Give it enough detail to know whether it should grow.</p></div>
        <div className="stage-stats"><span><b>{items.length}</b> total notes</span><span><b>{filtered.length}</b> in view</span></div>
      </section>

      <section className="folio-workbench" aria-labelledby="new-note-title">
        <div className="workbench-label"><span className="pin" /><p className="section-label">PLANT A NEW NOTE</p><p>Local browser storage only.</p></div>
        <div className="workbench-form">
          <label><span>Title</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="What wants to happen?" /></label>
          <label><span>Details</span><textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="The useful context for a collaborator…" /></label>
          <label><span>Status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <button id="new-note-title" className="seed-button" onClick={addItem}>Plant note <span>→</span></button>
        </div>
      </section>

      <section className="folio-list" aria-labelledby="notes-title">
        <div className="list-heading"><div><p className="section-label">THE SPECIMENS</p><h2 id="notes-title">Collaboration notes</h2></div><label className="search-field"><span>Search the folio</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="title, detail, status" /></label></div>
        {filtered.length === 0 ? <p className="empty-note">Nothing in this patch. Try a different search or plant a new note above.</p> : <ol className="note-list">{filtered.map((item, index) => <li key={item.id} className="note-row"><span className="row-number">{String(index + 1).padStart(2, "0")}</span><div className="note-copy"><h3>{item.title}</h3><p>{item.body || "No detail recorded yet."}</p></div><span className={`status status-${item.status.toLowerCase()}`}>{item.status}</span><button className="remove-button" onClick={() => noteStore.update((current) => removeNote(current, item.id))}>Remove</button></li>)}</ol>}
      </section>

      <footer className="folio-footer"><span>COLLABORATIONS / 2026</span><span>State stays in this browser. No backend is implied.</span></footer>
    </main>
  );
}
