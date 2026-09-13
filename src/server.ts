import app from "./app";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";

const port = config.port;

async function main() {
	try {
		await prisma.$connect();
		console.log("Database connected successfully");
		app.listen(port, () => {
			console.log(`Server starting port on ${port}`);
		});
	} catch (error) {
		console.log("Error starting the server", error);
		await prisma.$disconnect();
		process.exit(1);
	}
}

main();
