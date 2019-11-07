// The code written in BSD/KNF indent style
"use strict";

class FractaLaVue {
	constructor(windowSystemRoot, rootWindow) {
		this.SysRoot = windowSystemRoot;
		this.rootWindow = rootWindow;
		this.rootWindow.style.overflow = "hidden";
		this.rootWindow.rootInstance = this;
		this.rootWindowStyle = window.getComputedStyle(this.rootWindow);
		this.loopEnded = true;
		this.initFlag = false;

		this.canvasWidth = 800;
		this.canvasHeight = 800;

		this.fractalMap = [];
		this.fractalTimeStep = 5;
		this.fractalTimeMax = 10000;
		this.fractalTimeCurrent = 0;

		this.touchCounter = 0;
		this.touchCounting = false;

		this.overwritingButton = null;
		this.calcCModeButton = null;
		this.overwriting = false;
		this.fractalMode = "z_{n + 1} = z_{n} + c";
		this.calcCMode = "normal";

		this.timeClock = null;

		this.bitmap = null;
		this.canvas = null;
		this.context = null;
		this.viewScale = Math.max(this.canvasWidth, this.canvasHeight) / 4.0;
		this.viewScaleStep = 0.5;

		this.camera = {
			pos: {x: -1.0, y: 0.0, z: 0.0},
		};

		this.prev_mouse = {x: 0, y: 0};
		this.prev_touches = [];

		// Initialize
		this.init();
	}

// ----- Initialize -----
	init()
	{
		// Initialize canvas
		this.prepareCanvas();
		// Set event listener
		this.rootWindow.addEventListener("keydown", function (e) { e.currentTarget.rootInstance.keyDown(e); }, false);
		this.rootWindow.addEventListener("wheel", function (e) { e.currentTarget.rootInstance.wheelMove(e); }, false);
		// Create UI parts
		this.prepareTools();

		// Set initial position and velocity
		this.initFractal();

		// Start loop
		this.startLoop();
	}

	startLoop()
	{
		let root = this;
		this.timeClock = setInterval(function () { root.loop(); }, 100);
	}

	prepareCanvas()
	{
		// Initialize canvas
		this.canvas = document.createElement("canvas");
		this.canvas.rootInstance = this;
		this.canvas.id = "FractaLaVueMainPool";
		this.canvas.style.width = this.canvasWidth + "px";
		this.canvas.style.height = this.canvasHeight + "px";
		this.rootWindow.appendChild(this.canvas);
		this.canvas.addEventListener(
		    "windowdrag",
		    function (e) {
			    let style = window.getComputedStyle(e.currentTarget);
			    e.currentTarget.width = parseInt(style.width, 10);
			    e.currentTarget.height = parseInt(style.height, 10);
			    let root = e.currentTarget.rootInstance;
			    root.displayOffset.x = e.currentTarget.width / 2.0;
			    root.displayOffset.y = e.currentTarget.height / 2.0;
		    },
		    false);
		this.canvas.addEventListener("mousedown", function (e) { e.currentTarget.rootInstance.mouseClick(e); }, false);
		this.canvas.addEventListener("mousemove", function (e) { e.currentTarget.rootInstance.mouseMove(e); }, false);
		this.canvas.addEventListener("touchstart", function (e) { e.currentTarget.rootInstance.mouseClick(e); }, false);
		this.canvas.addEventListener("touchmove", function (e) { e.currentTarget.rootInstance.mouseMove(e); }, false);
		this.canvas.addEventListener("dblclick", function (e) { e.currentTarget.rootInstance.mouseDblClick(e); }, false);
		this.context = this.canvas.getContext("2d");
		// Initialize canvas size
		let canvasStyle = window.getComputedStyle(this.canvas);
		this.canvas.width = parseInt(canvasStyle.width, 10);
		this.canvas.height = parseInt(canvasStyle.height, 10);
		// Initialize bitmap
		this.bitmap = this.context.createImageData(this.canvas.width, this.canvas.height);
		// Set alpha of all pixels equal to 1.0
		for (let i = 0; i < this.canvas.width * this.canvas.height; i++) {
			this.bitmap.data[4 * i + 3] = 255;
		}
	}

	prepareTools()
	{
		this.overwritingButton = document.createElement("div");
		this.overwritingButton.rootInstance = this;
		this.overwritingButton.innerHTML = "Overwriting";
		this.overwritingButton.id = "FractaLaVueOverWritingButton";
		this.overwritingButton.addEventListener("mousedown", function (e) { e.preventDefault(); e.currentTarget.rootInstance.switchOverwriting(e); }, false);
		this.overwritingButton.addEventListener("touchstart", function (e) { e.preventDefault(); e.currentTarget.rootInstance.switchOverwriting(e); }, false);
		this.rootWindow.appendChild(this.overwritingButton);

		this.calcCModeButton = document.createElement("div");
		this.calcCModeButton.rootInstance = this;
		this.calcCModeButton.innerHTML = "calc C mode (" + this.calcCMode + ")";
		this.calcCModeButton.id = "FractaLaVueCalcCModeButton";
		this.calcCModeButton.addEventListener("mousedown", function (e) { e.preventDefault(); e.currentTarget.rootInstance.switchCalcCMode(e); }, false);
		this.calcCModeButton.addEventListener("touchstart", function (e) { e.preventDefault(); e.currentTarget.rootInstance.switchCalcCMode(e); }, false);
		this.rootWindow.appendChild(this.calcCModeButton);
	}

	initFractal() {
		this.fractalTimeCurrent = 0;
		for (let i = 0; i < this.canvas.height * this.canvas.width; i++) {
			this.fractalMap[i] = {
				t: 0,
				z: {re: 0, im: 0}};
		}
	}


	// ----- Start Simulation -----
	loop()
	{
		if (!this.loopEnded) {
			return;
		}
		if (this.initFlag) {
			this.initFlag = false;
			this.initFractal();
		}
		this.calculate();
		this.draw();
		this.loopEnded = true;
	}



	// ----- REALTIME -----
	calculate()
	{
		for (let t = 0; t < this.fractalTimeStep; t++) {
			this.fractalTimeCurrent += 1;
			for (let m = 0; m < this.canvas.height; m++) {
				for (let n = 0; n < this.canvas.width; n++) {
					let z = this.fractalMap[this.canvas.width * m + n].z;
					let zp = this.c_plus(
						this.c_mult(z, z),
						this.c_getC({
							re: this.camera.pos.x + (n - this.canvas.width / 2.0) / this.viewScale,
							im: this.camera.pos.y + (m - this.canvas.height / 2.0) / this.viewScale
						}, this.calcCMode));
					this.fractalMap[this.canvas.width * m + n].z = zp;
					if (this.c_abs(zp) < 2.0) {
						this.fractalMap[this.canvas.width * m + n].t += 1;
					}
				}
			}
		}
	}

	c_plus(z1, z2)
	{
		return {re: z1.re + z2.re, im: z1.im + z2.im};
	}

	c_mult(z1, z2)
	{
		return {re: z1.re * z2.re - z1.im * z2.im,
			im: z1.im * z2.re + z1.re * z2.im};
	}

	c_abs(z)
	{
		return Math.sqrt(z.re * z.re + z.im * z.im);
	}

	c_getC(z, mode)
	{
		if (mode === "exp") {
			let r = Math.exp(z.re);
			return {re: r * Math.cos(z.im),
				im: r * Math.sin(z.im)};
		} else if (mode === "z^2") {
			return this.c_mult(z, z);
		} else { // "normal"
			return {re: z.re,
				im: z.im};
		}
	}

	draw()
	{
		this.drawPlane(this.camera);
	}

	drawPlane(camera)
	{
		for (let m = 0; m < this.canvas.height; m++) {
			for (let n = 0; n < this.canvas.width; n++) {
				if (this.c_abs(this.fractalMap[this.canvas.width * m + n].z) < 2.0) {
					this.bitmap.data[4 * (this.canvas.width * m + n)] = 255;
					this.bitmap.data[4 * (this.canvas.width * m + n) + 1] = 255;
					this.bitmap.data[4 * (this.canvas.width * m + n) + 2] = 0;
				} else {
					let time = Math.pow(this.fractalMap[this.canvas.width * m + n].t / this.fractalTimeCurrent, 0.18);
					this.bitmap.data[4 * (this.canvas.width * m + n)] = Math.ceil(time * 255);
					this.bitmap.data[4 * (this.canvas.width * m + n) + 1] = 0;
					this.bitmap.data[4 * (this.canvas.width * m + n) + 2] = 0;
				}
			}
		}
		this.context.putImageData(this.bitmap, 0, 0);
	}

	moveCamera(x, y, zoom)
	{
		this.camera.pos.x += x;
		this.camera.pos.y += y;
		if (zoom != 0) {
			this.viewScale *= zoom;
		}
		// Init fractal because the map can't scale correctly
		this.initFlag = true;
	}

	mouseClick(event)
	{
		event.preventDefault();
		let root = this;
		if (event.type === "mousedown") {
			//this.prev_mouse = {clientX: event.clientX, clientY: event.clientY};
			this.prev_mouse = this.pointerPositionDecoder(event);
		} else if (event.type === "touchstart") {
			let touches_current = Array.from(event.touches);
			this.prev_touches = touches_current.map(this.extractTouches, this);
			if (this.touchCounting && event.touches.length == 1) {
				this.touchDblTap(event);
			}
			if (event.touches.length == 1) {
				// Set touchCounting should be at end of event processing
				this.touchCounting = true;
				clearTimeout(this.touchCounter);
				this.touchCounter = setTimeout(function () { root.touchCounting = false; }, 200);
			}
		}
	}

	mouseMove(event)
	{
		event.preventDefault();
		if (event.type === "mousemove") {
			let pointer = this.pointerPositionDecoder(event);
			let move = {x: 0, y: 0};
			move.x = (pointer.x - this.prev_mouse.x) / this.viewScale;
			move.y = (pointer.y - this.prev_mouse.y) / this.viewScale;
			if ((event.buttons & 1) != 0) {
				// Invert signs because we want move the plane
				this.moveCamera(-move.x, -move.y, 0);
			}
			this.prev_mouse = {x: pointer.x, y: pointer.y};
		} else if (event.type === "touchmove") {
			let touches_current = Array.from(event.touches);
			let move = {x: 0, y: 0};
			if (touches_current.length == 1) {
				let pointer = this.pointerPositionDecoder(touches_current[0]);
				let n = this.prev_touches.findIndex(function (element, index, touches) {
					if (element.identifier == this[0].identifier) {
						return true;
					} else {
						return false;
					}
				    },
				    touches_current);
				if (n >= 0) {
					move.x = (pointer.x - this.prev_touches[n].x) / this.viewScale;
					move.y = (pointer.y - this.prev_touches[n].y) / this.viewScale;
					//this.rotCamera(
					//    -2.0 * Math.PI * move.x / this.rotDegree,
					//    2.0 * Math.PI * move.y / this.rotDegree);
				}
			} else if (touches_current.length == 2 && this.prev_touches.length == 2) {
				let p0 = this.prev_touches[0];
				let p1 = this.prev_touches[1];
				let r0 = this.pointerPositionDecoder(touches_current[0]);
				let r1 = this.pointerPositionDecoder(touches_current[1]);
				move.x = ((r0.x + r1.x) - (p0.x + p1.x)) * 0.5 / this.viewScale;
				move.y = ((r0.y + r1.y) - (p0.y + p1.y)) * 0.5 / this.viewScale;
				let dp = Math.sqrt(Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2));
				let d = Math.sqrt(Math.pow(r0.x - r1.x, 2) + Math.pow(r0.y - r1.y, 2));
				// Invert signs because we want move the plane
				this.moveCamera(-move.x, -move.y, 1 + Math.sign(d - dp) * this.viewScaleStep);
			}
			this.prev_touches = touches_current.map(this.extractTouches, this);
		}
	}

	pointerPositionDecoder(pointer)
	{
		let rect = this.rootWindow.getBoundingClientRect();
		let pos = {
			x: pointer.clientX - rect.left,
			y: pointer.clientY - rect.top
		};
		return pos;
	}

	extractTouches(a)
	{
		let pos = this.pointerPositionDecoder(a);
		return {x: pos.x, y: pos.y, identifier: a.identifier};
	}

	mouseDblClick(event)
	{
		event.preventDefault();
		this.chaseBHInvoked = true;
		this.chasingBHDistanceCurrent = this.chaseBHDistance;
		this.chaseBHClickedPos = this.pointerPositionDecoder(event);
	}

	touchDblTap(event)
	{
		this.chaseBHInvoked = true;
		this.chasingBHDistanceCurrent = this.chaseBHDistance;
		this.chaseBHClickedPos = this.pointerPositionDecoder(event.touches[0]);
	}

	wheelMove(e)
	{
		event.preventDefault();
		this.moveCamera(0, 0, 1 - Math.sign(event.deltaY) * this.viewScaleStep);
	}

	keyDown(event)
	{
		switch (event.key) {
			case "ArrowUp":
				break;
			case "ArrowDown":
				break;
			case "ArrowLeft":
				break;
			case "ArrowRight":
				break;
		}
	}

	switchOverwriting()
	{
		this.overwriting = !this.overwriting;
	}

	switchCalcCMode()
	{
		switch (this.calcCMode) {
			case "normal":
				this.calcCMode = "exp";
				this.calcCModeButton.innerHTML = "<math>" +
				    "<mi>c</mi><mo>=</mo>" +
				    "<mi>exp</mi><mo>&ApplyFunction;</mo><mrow><mo>(</mo><mi>x</mi><mo>+</mo><mi>i</mi><mi>y</mi><mo>)</mo></mrow>" +
				    "</math>";
				break;
			case "exp":
				this.calcCMode = "z^2";
				this.calcCModeButton.innerHTML = "<math>" +
				    "<mi>c</mi><mo>=</mo>" +
				    "<msup><mrow><mo>(</mo><mi>x</mi><mo>+</mo><mi>i</mi><mi>y</mi><mo>)</mo></mrow><mn>2</mn></msup>" +
				    "</math>";
				break;
			default:
				this.calcCMode = "normal";
				this.calcCModeButton.innerHTML = "c = x + i * y";
				this.calcCModeButton.innerHTML = "<math>" +
				    "<mi>c</mi><mo>=</mo>" +
				    "<mi>x</mi><mo>+</mo><mi>i</mi><mi>y</mi>" +
				    "</math>";
		}
		this.initFlag = true;
	}
}

