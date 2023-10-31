import Bull from "bull";

const bullQueue = new Bull('queue', process.env.REDIS_URL);

export default bullQueue;
