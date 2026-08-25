import { parseMCQ } from '../utils/mcqParser.js';

const ocrTextPage1 = `REG NO : NAME :
MARKS SCORED
SHREE VENKATESHWARA HI-TECH ENGINEERING COLLEGE
(An Autonomous Institution, Approved by AICTE, New Delhi, 
Affiliated to Anna University, Chennai, Accredited with “A” Grade by NAAC)
Gobi-Sathy Main Road, Othakkuthirai, Gobichettipalayam, Erode -638455.
Department of ELECTRONICS & COMMUNICATION ENGINEERING
Objective Test-I
Regulations: 2023 23ECE13 LOW POWER IC DESIGN
Class: IV Year / VII Semester Batch: 2023-2027 Marks: 25
Q Questions CO BL
1. The primary need for low power circuit design in modern VLSI systems is to:
A) Increase chip size
B) Reduce heat generation and improve battery life
C) Increase clock frequency only
D) Simplify circuit layout
CO1 K2
2. Switching power dissipation in CMOS circuits is mainly due to:
A) Leakage current
B) Charging and discharging of load capacitance
C) Short circuit current
D) Subthreshold conduction
CO1 K2
3. Short circuit power dissipation occurs when:
A) Only PMOS is ON
B) Only NMOS is ON
C) Both PMOS and NMOS conduct simultaneously
D) No transistor conducts
CO1 K2
4. Leakage power dissipation is dominant in:
A) High voltage designs
B) Large feature size technologies
C) Deep submicron technologies
D) Analog circuits only
CO1 K1
5. Glitching power dissipation is caused by:
A) Constant DC current
B) Unwanted switching transitions
C) Reduced supply voltage
D) Thermal noise
CO1 K2
6. Drain Induced Barrier Lowering (DIBL) results in:
A) Increase in threshold voltage
B) Decrease in threshold voltage
C) No change in threshold voltage
D) Infinite resistance
CO1 K2
7. Punch-through effect occurs when:
A) Gate oxide breaks down
B) Source and drain depletion regions merge
C) Only gate voltage increases
D) Channel length increases
CO1 K1`;

const mockDoc = {
    documentId: 'mock-ocr-id',
    filename: 'scanned_page1.pdf',
    type: 'pdf',
    pages: 1,
    blocks: [
        {
            page: 1,
            type: 'line',
            text: ocrTextPage1,
            sourceIndex: 0
        }
    ]
};

const parsed = parseMCQ(mockDoc);
console.log('Parsed questions count:', parsed.length);
if (parsed.length > 0) {
    console.log('First parsed question details:', JSON.stringify(parsed[0], null, 2));
} else {
    console.log('No questions parsed.');
}
