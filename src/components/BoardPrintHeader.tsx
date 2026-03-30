import React from 'react';


interface BoardPrintHeaderProps {
    onPrint: () => void;
    rules?: string;
}

const defaultRules = `How to Play:\n- Pick any open square(s) on the board and claim with your name/alias.\n- Once all squares are filled, the numbers 0-9 are randomly assigned to each row and column.\n- At the end of each quarter, the last digit of each team's score determines the winning square (row = Team A, column = Team B).\n- Payouts and charity split are shown in the contest details.\n- Pay for your squares using the provided payment options. Unpaid squares may be reassigned.\n- See the 'Winners' tab for live results and payout info.`;

const BoardPrintHeader: React.FC<BoardPrintHeaderProps> = ({ onPrint, rules }) => (
    <div className="print-header w-full max-w-4xl mx-auto mb-6 p-4 bg-white rounded-2xl shadow-md flex flex-col items-center print:shadow-none print:mb-2 print:p-2">
        <h1 className="text-2xl md:text-3xl font-black text-indigo-900 uppercase mb-2 text-center">Charity Squares Board</h1>
        <pre className="text-xs md:text-sm text-gray-700 bg-gray-50 rounded-xl p-3 mb-2 whitespace-pre-wrap text-left w-full print:bg-white print:p-1 print:mb-1">{rules || defaultRules}</pre>
        <button
            onClick={onPrint}
            className="print:hidden mt-2 px-6 py-2 bg-indigo-700 text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow hover:bg-indigo-900 transition-all"
        >
            Print Board
        </button>
    </div>
);

export default BoardPrintHeader;
