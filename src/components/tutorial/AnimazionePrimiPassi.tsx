'use client';

/**
 * **Il ciclo dell'app in sette secondi, senza parole**: tre tocchi mettono i punti, la
 * linea li unisce, compaiono i campi dell'Editor e infine il verdetto del meteo.
 *
 * Sta nel primo passo della guida, sotto la scelta del livello. È un disegno **decorativo**
 * (`aria-hidden`): la spiegazione vera è il testo del passo, e chi usa un lettore di
 * schermo la riceve da lì per intero.
 *
 * ## Come è fatta
 *
 * SVG in linea e keyframe CSS, nessuna dipendenza. Ogni elemento porta la SUA fase come
 * **percentuali dello stesso ciclo di sette secondi** — non `animation-delay`: il ritardo
 * sposta la fase dell'intero loop, quindi alla fine di ogni giro gli elementi
 * sfumerebbero uno alla volta invece che insieme, e il primo tocco del giro nuovo
 * arriverebbe con la coda del giro vecchio ancora a schermo.
 *
 * I colori sono i **token del tema** (`--grigio-*`, `--verde-400`), non esadecimali: nel
 * tema chiaro la scala dei grigi si rovescia, e un disegnino coi grigi scuri fissi
 * sarebbe stato un riquadro notturno in mezzo a un pannello diurno — visto a schermo al
 * primo giro, non dai test. Solo il verdetto del meteo tiene il suo azzurro: sta sopra un
 * colore pieno, come le pastiglie, e non segue la pagina.
 *
 * Con `prefers-reduced-motion` le animazioni si spengono e resta il **fotogramma finale**
 * (punti, linea, editor e meteo tutti visibili): senza quel fallback esplicito, spegnere
 * le animazioni mostrerebbe una mappa vuota.
 */
export function AnimazionePrimiPassi() {
  return (
    <div className="mt-3 rounded-lg border border-gray-600 overflow-hidden" aria-hidden="true">
      <style>{`
        .ppp-tocco-0, .ppp-tocco-1, .ppp-tocco-2 { opacity: 0; transform-origin: center; transform-box: fill-box; }
        .ppp-tocco-0 { animation: ppp-tocco-0 7s infinite; }
        .ppp-tocco-1 { animation: ppp-tocco-1 7s infinite; }
        .ppp-tocco-2 { animation: ppp-tocco-2 7s infinite; }
        .ppp-punto-0 { animation: ppp-punto-0 7s infinite; }
        .ppp-punto-1 { animation: ppp-punto-1 7s infinite; }
        .ppp-punto-2 { animation: ppp-punto-2 7s infinite; }
        .ppp-linea  { stroke-dasharray: 100; animation: ppp-linea 7s infinite; }
        .ppp-editor { animation: ppp-editor 7s infinite; }
        .ppp-meteo  { animation: ppp-meteo 7s infinite; }

        @keyframes ppp-tocco-0 {
          0%, 3%   { opacity: 0; transform: scale(0.3); }
          6%       { opacity: 0.7; transform: scale(0.6); }
          11%      { opacity: 0; transform: scale(1.6); }
          100%     { opacity: 0; }
        }
        @keyframes ppp-tocco-1 {
          0%, 16%  { opacity: 0; transform: scale(0.3); }
          19%      { opacity: 0.7; transform: scale(0.6); }
          24%      { opacity: 0; transform: scale(1.6); }
          100%     { opacity: 0; }
        }
        @keyframes ppp-tocco-2 {
          0%, 29%  { opacity: 0; transform: scale(0.3); }
          32%      { opacity: 0.7; transform: scale(0.6); }
          37%      { opacity: 0; transform: scale(1.6); }
          100%     { opacity: 0; }
        }
        @keyframes ppp-punto-0 { 0%, 4%  { opacity: 0; } 8%, 92%  { opacity: 1; } 97%, 100% { opacity: 0; } }
        @keyframes ppp-punto-1 { 0%, 17% { opacity: 0; } 21%, 92% { opacity: 1; } 97%, 100% { opacity: 0; } }
        @keyframes ppp-punto-2 { 0%, 30% { opacity: 0; } 34%, 92% { opacity: 1; } 97%, 100% { opacity: 0; } }
        @keyframes ppp-linea {
          0%, 8%   { stroke-dashoffset: 100; opacity: 1; }
          42%      { stroke-dashoffset: 0; }
          92%      { stroke-dashoffset: 0; opacity: 1; }
          97%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes ppp-editor { 0%, 48% { opacity: 0; } 54%, 92% { opacity: 1; } 97%, 100% { opacity: 0; } }
        @keyframes ppp-meteo  { 0%, 62% { opacity: 0; } 68%, 92% { opacity: 1; } 97%, 100% { opacity: 0; } }

        @media (prefers-reduced-motion: reduce) {
          .ppp-tocco-0, .ppp-tocco-1, .ppp-tocco-2 { animation: none; opacity: 0; }
          .ppp-punto-0, .ppp-punto-1, .ppp-punto-2,
          .ppp-editor, .ppp-meteo { animation: none; opacity: 1; }
          .ppp-linea { animation: none; stroke-dashoffset: 0; }
        }
      `}</style>
      <svg viewBox="0 0 280 150" className="w-full block bg-gray-800">
        {/* Curve di livello: bastano ad annunciare «questa è una mappa». */}
        <path d="M -10 40 Q 60 10 120 38 T 290 30" fill="none" stroke="rgb(var(--grigio-500))" strokeWidth="1" opacity="0.5" />
        <path d="M -10 75 Q 80 45 150 72 T 290 62" fill="none" stroke="rgb(var(--grigio-500))" strokeWidth="1" opacity="0.4" />
        <path d="M -10 110 Q 70 85 160 105 T 290 96" fill="none" stroke="rgb(var(--grigio-500))" strokeWidth="1" opacity="0.3" />

        {/* Il percorso si disegna man mano che i punti arrivano. */}
        <path
          className="ppp-linea"
          d="M 45 105 L 130 52 L 225 88"
          pathLength={100}
          fill="none"
          stroke="rgb(var(--verde-400))"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Tre tocchi, tre punti: la fase di ognuno sta nei suoi keyframe. */}
        {[
          { x: 45, y: 105, slot: 0 },
          { x: 130, y: 52, slot: 1 },
          { x: 225, y: 88, slot: 2 },
        ].map(({ x, y, slot }) => (
          <g key={slot}>
            <circle
              className={`ppp-tocco-${slot}`}
              cx={x} cy={y} r="14" fill="none" stroke="rgb(var(--grigio-300))" strokeWidth="2"
            />
            <circle
              className={`ppp-punto-${slot}`}
              cx={x} cy={y} r="5.5" fill="rgb(var(--verde-400))" stroke="rgb(var(--grigio-950))" strokeWidth="1.5"
            />
          </g>
        ))}

        {/* L'Editor: i campi da completare, stilizzati come nella barra vera. */}
        <g className="ppp-editor">
          <rect x="14" y="122" width="120" height="18" rx="4" fill="rgb(var(--grigio-900))" stroke="rgb(var(--grigio-600))" strokeWidth="1" />
          <text x="22" y="135" fontSize="9" fill="rgb(var(--grigio-400))">✏️</text>
          <rect x="38" y="127" width="26" height="8" rx="2" fill="rgb(var(--grigio-700))" />
          <rect x="70" y="127" width="26" height="8" rx="2" fill="rgb(var(--grigio-700))" />
          <rect x="102" y="127" width="26" height="8" rx="2" fill="rgb(var(--grigio-700))" />
        </g>

        {/* E il verdetto: a che ora arrivi, e che cielo trovi. */}
        <g className="ppp-meteo">
          <rect x="176" y="122" width="90" height="18" rx="9" fill="#0e7490" />
          <text x="186" y="135" fontSize="10" fill="#f0fdfa">⛅ 🕐 14:30</text>
        </g>
      </svg>
    </div>
  );
}
