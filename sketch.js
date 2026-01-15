let port, reader;

let isRecording = false;



// GSR values

let gsrA = 0, gsrB = 0, gsrC = 0;

let smoothA = 0, smoothB = 0, smoothC = 0;

let spikeThreshold = 30;



// Session timer

let sessionStartTime = 0;

let elapsedTime = 0;



// CSV log

let dataLog = [];



// JSON log

let sessionMeta = {

  sessionStarted: "",

  sessionEnded: "",

  baseline: 700,

  data: []

};



// log 1Hz timer

let lastLogTime = 0;



// JSON viewer toggle

let jsonViewerOpen = true;



// Button objects

let buttons = [];



function setup() {

  createCanvas(windowWidth, windowHeight);

  initButtons();

}



function windowResized() {

  resizeCanvas(windowWidth, windowHeight);

  initButtons(); // reposition buttons on resize

}



//Serial connection

async function connectSerial() {

  try {

    port = await navigator.serial.requestPort();

    await port.open({ baudRate: 9600 });

    reader = port.readable.getReader();

    readLoop();

  } catch (err) {

    console.log("Serial connection error:", err);

  }

}



async function readLoop() {

  while (port.readable) {

    try {

      const { value, done } = await reader.read();

      if (done) break;

      if (value) parseSerialData(new TextDecoder().decode(value).trim());

    } catch (err) {

      console.log(err);

      break;

    }

  }

}



function parseSerialData(data) {

  if (!data.includes(",")) return;

  let parts = data.split(",");

  if (parts.length !== 3) return;

  gsrA = int(parts[0]);

  gsrB = int(parts[1]);

  gsrC = int(parts[2]);

}



//Main draw

function draw() {

  background(20);



  //Dummy values if serial not connected

  if (!port) {

    gsrA = 100;

    gsrB = 400;

    gsrC = 600;

  }



//prevent NaN propagation

if (!isFinite(gsrA)) gsrA = 700;

if (!isFinite(gsrB)) gsrB = 700;

if (!isFinite(gsrC)) gsrC = 700;



smoothA = lerp(isFinite(smoothA) ? smoothA : gsrA, gsrA, 0.1);

smoothB = lerp(isFinite(smoothB) ? smoothB : gsrB, gsrB, 0.1);

smoothC = lerp(isFinite(smoothC) ? smoothC : gsrC, gsrC, 0.1);



  if (isRecording) elapsedTime = millis() - sessionStartTime;

  if (isRecording) logData();  // NEW: only once per second



  drawTitle();

  drawButtons();

  drawSessionTime();

  drawLegend();

  drawCircles();

  drawSpikes();

  drawJSONViewer(); // NEW

}



//Layout

function drawTitle() {

  fill(230); textAlign(CENTER, TOP);

  textSize(width*0.04);

  text("Emotional Sync", width/2, 20);

}



//Buttons

class Button {

  constructor(x, y, w, h, label, action) {

    this.x = x; this.y = y; this.w = w; this.h = h;

    this.label = label; this.action = action;

    this.anim = 0;

  }



  draw() {

    let scaleAmt = lerp(1, 0.9, this.anim);

    let bright = lerp(30, 60, this.anim);

    push();

    translate(this.x + this.w/2, this.y + this.h/2);

    scale(scaleAmt);

    rectMode(CENTER);

    stroke(255); fill(bright); strokeWeight(2); rect(0,0,this.w,this.h,5);

    noStroke(); fill(230); textSize(16); textAlign(CENTER,CENTER);

    text(this.label, 0, 0);

    pop();

    this.anim *= 0.8;

  }



  isMouseOver() {

    return mouseX > this.x && mouseX < this.x+this.w &&

           mouseY > this.y && mouseY < this.y+this.h;

  }



  press() {

    this.anim = 1;

    this.action();

  }

}



function initButtons() {

  let w = 90, h = 30;

  let y = 20;



  buttons = [];



  // Top-left

  let xStart = 20;



  buttons.push(new Button(xStart, y, w, h, "Reset", ()=>{

    elapsedTime = 0;

    if (isRecording) sessionStartTime = millis();

  }));



  buttons.push(new Button(xStart + w + 10, y, w, h, "Start", ()=>{

    isRecording = true;

    sessionStartTime = millis();

    sessionMeta.sessionStarted = new Date().toISOString();

    sessionMeta.data = [];

    dataLog = []; // reset csv log too

  }));



  buttons.push(new Button(xStart + 2*(w+10), y, w, h, "Stop", ()=>{

    isRecording = false;

    sessionMeta.sessionEnded = new Date().toISOString();

  }));



  // Top-right

  let connectX = width - w - 20;



  buttons.push(new Button(connectX, y, w, h, "Connect", connectSerial));



  buttons.push(new Button(connectX - w - 10, y, w, h, "Save JSON", exportJSON));



  buttons.push(new Button(connectX - 2*(w + 10), y, w, h, "Save CSV", exportCSV));

}



function drawButtons() {

  for (let b of buttons) b.draw();

}



function mousePressed() {

  for(let b of buttons) if(b.isMouseOver()) b.press();

}



//Session Time

function drawSessionTime(){

  fill(230); textSize(width*0.02); textAlign(LEFT, BOTTOM);

  text("Session: " + formatTime(elapsedTime), 20, height-20);

}



//Colour Legend

function drawLegend(){

  let w = 150, h = 15;

  let x = width - w - 20, y = height - 40;



  noFill();

  strokeWeight(1);

  for(let i=0;i<w;i++){

    let t = i/w;

    stroke(lerpColor(color(60,0,200), color(255,0,0), t));

    line(x+i, y, x+i, y+h);

  }



  noStroke(); fill(230); textSize(14);

  textAlign(LEFT, BOTTOM); text("Low", x, y+h+15);

  textAlign(CENTER, BOTTOM); text("Medium", x+w/2, y+h+15);

  textAlign(RIGHT, BOTTOM); text("High", x+w, y+h+15);

}



//Circles

function drawCircles(){

  let circleY = height/2;

  let circleX = [width*0.2, width*0.5, width*0.8];

  let rawValues = [gsrA, gsrB, gsrC];

  let smoothValues = [smoothA, smoothB, smoothC];

  let labels = ["Participant (GSR A)","Observer 1 (GSR B)","Observer 2 (GSR C)"];

  let size = min(width,height)*0.2;



  for(let i=0;i<3;i++){

    let val = smoothValues[i];

    if(isNaN(val)) val = 700;



    let t = constrain(map(val, 600, 850, 0, 1), 0, 1);

    let col;

    if(t < 0.5){

      col = lerpColor(color(0,120,255), color(150,0,200), t*2);

    } else {

      col = lerpColor(color(150,0,200), color(255,0,60), (t-0.5)*2);

    }



    push();

    noStroke(); fill(col);

    drawingContext.shadowBlur = 25;

    drawingContext.shadowColor = col.toString();

    ellipse(circleX[i], circleY, size);

    drawingContext.shadowBlur = 0;



    fill(230); textSize(20); textAlign(CENTER,CENTER);

    text(labels[i], circleX[i], circleY + size/1.5);



    textSize(16);

    text(rawValues[i], circleX[i], circleY + size/1.5 + 25);

    pop();

  }

}



//Spike flash

function drawSpikes(){

  let circleY = height/2;

  let circleX = [width*0.2, width*0.5, width*0.8];

  if(abs(smoothA-gsrA)>spikeThreshold) drawSpike(circleX[0],circleY);

  if(abs(smoothB-gsrB)>spikeThreshold) drawSpike(circleX[1],circleY);

  if(abs(smoothC-gsrC)>spikeThreshold) drawSpike(circleX[2],circleY);

}



function drawSpike(x,y){

  push(); noFill(); stroke(255,255,255,200); strokeWeight(4);

  ellipse(x,y,min(width,height)*0.22); pop();

}



//CSV Logging

function logData() {

  if (!isRecording) return;



  if (millis() - lastLogTime < 1000) return;

  lastLogTime = millis();



  let totalMs = elapsedTime;

  let minutes = nf(floor(totalMs / 1000 / 60), 2);

  let seconds = nf(floor((totalMs / 1000) % 60), 2);

  let ms = nf(floor(totalMs % 1000), 3);

  let timestamp = `${minutes}:${seconds}:${ms}`;



  let entry = {

  time: timestamp,

  gsrA: isFinite(smoothA) ? smoothA : gsrA,

  gsrB: isFinite(smoothB) ? smoothB : gsrB,

  gsrC: isFinite(smoothC) ? smoothC : gsrC

};





  dataLog.push(entry);

  sessionMeta.data.push(entry);

}



function exportCSV() {

  if (dataLog.length === 0) return;



  let csvContent = "Time,GSR A,GSR B,GSR C\n";



  dataLog.forEach(row => {

    csvContent += `${row.time},${row.gsrA.toFixed(2)},${row.gsrB.toFixed(2)},${row.gsrC.toFixed(2)}\n`;

  });



  let blob = new Blob([csvContent], { type: "text/csv" });

  let url = URL.createObjectURL(blob);



  let a = createA(url, "download", "_blank");

  a.attribute("download", "GSR_data.csv");

  a.elt.click();

  a.remove();

}



//JSON Export

function exportJSON() {

  let blob = new Blob([JSON.stringify(sessionMeta, null, 2)], { type: "application/json" });

  let url = URL.createObjectURL(blob);



  let a = createA(url, "download", "_blank");

  a.attribute("download", "session_data.json");

  a.elt.click();

  a.remove();

}



//JSON Viewer

function drawJSONViewer() {

  if (!jsonViewerOpen) return;



  let w = 320, h = 220, x = 20, y = 100;



  push();

  fill(30, 200);

  stroke(255);

  rect(x, y, w, h, 10);



  fill(255);

  textAlign(LEFT, TOP);

  textSize(14);

  text("Session Data (last 10 rows):", x + 15, y + 12);



  let recent = sessionMeta.data.slice(-10);

  let textY = y + 40;



  for (let row of recent) {

    let line = `${row.time} | A:${row.gsrA.toFixed(1)} B:${row.gsrB.toFixed(1)} C:${row.gsrC.toFixed(1)}`;

    text(line, x + 15, textY);

    textY += 16;

  }



  pop();

}



//Time formatter

function formatTime(ms){

  let totalSec = floor(ms/1000);

  let min = floor(totalSec/60);

  let sec = totalSec%60;

  return nf(min,2)+":"+nf(sec,2);

}
