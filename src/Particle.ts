import { seededRandom } from "./mulberry32";

class Particle {
    private temperature = 0;
    private maxVelocity = 0;
    private flowStrength = 0;
    public position: { x: number, y: number, };
    private velocity: { x: number, y: number, };
    private previousPosition: { x: number, y: number, };
    private color: string;

    constructor(position: { x: number, y: number, }, color: string, width: number, height: number, flowX: number, flowY: number, context: CanvasRenderingContext2D) {
        this.position = position;
        this.velocity = { x: 0, y: 0, };
        // Setting the previous position here is redundant (also set in update function) to avoid lint errors.
        this.previousPosition = { ...this.position };
        this.color = color;
        this.update(width, height, this.temperature, flowX, flowY, context);
    }

    update = (width: number, height: number, temperature: number, flowX: number, flowY: number, context: CanvasRenderingContext2D) => {
        this.previousPosition = { ...this.position };

        this.temperature = temperature;
        // Base and range of max velocity was determined by experimentation.
        this.maxVelocity = 1 + this.temperature;
        // Base, range, and max-velocity relation of flow strength determined by experimentation.
        this.flowStrength = seededRandom() * 0.08 * this.maxVelocity / 3 + 0.08 * this.maxVelocity * 2 / 3;

        this.velocity.x = this.velocity.x + flowX * this.flowStrength;
        this.velocity.y = this.velocity.y + flowY * this.flowStrength;
        const velocityMagnitude = Math.sqrt(this.velocity.y ** 2 + this.velocity.x ** 2);
        if (velocityMagnitude > this.maxVelocity) {
            this.velocity.x *= this.maxVelocity / velocityMagnitude;
            this.velocity.y *= this.maxVelocity / velocityMagnitude;
        }
        this.position.x = this.position.x + this.velocity.x;
        this.position.y = this.position.y + this.velocity.y;

        context.strokeStyle = this.color;
        context.beginPath();
        context.moveTo(this.previousPosition.x, this.previousPosition.y);
        context.lineTo(this.position.x, this.position.y);
        context.stroke();
        let corrected = false;
        while (this.position.x < 0) {
            this.position.x += width;
            corrected = true;
        }
        while (this.position.x >= width) {
            this.position.x -= width;
            corrected = true;
        }
        while (this.position.y < 0) {
            this.position.y += height;
            corrected = true;
        }
        while (this.position.y >= height) {
            this.position.y -= height;
            corrected = true;
        }
        context.beginPath();
        context.moveTo(this.position.x - this.velocity.x, this.position.y - this.velocity.y);
        context.lineTo(this.position.x, this.position.y);
        context.stroke();
    }
}

export default Particle;
