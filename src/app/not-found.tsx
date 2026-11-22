import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty" style={{ marginTop: 40 }}>
      <h1 style={{ fontSize: 22 }}>Página não encontrada</h1>
      <p>Esse endereço não existe no Hobby. Pode ter sido digitado errado ou a página mudou de lugar.</p>
      <div className="row gap8 mt16" style={{ justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/descobrir" className="btn" style={{ width: "auto" }}>Ir para Descobrir</Link>
        <Link href="/buscar" className="btn ghost" style={{ width: "auto" }}>Buscar</Link>
      </div>
    </div>
  );
}
