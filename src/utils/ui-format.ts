function getTodaysDate() {
	return new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
	});
}

function getFirstName(full_name: string) {
	return full_name.split(" ")[0];
}

function greetMessage() {
	let timeOfTheDay = "Morning";
	const time = new Date().getHours();
	if (time >= 12) timeOfTheDay = "Afternoon";
	if (time >= 17) timeOfTheDay = "Evening";
	if (time >= 21) timeOfTheDay = "Night";
	return `Good ${timeOfTheDay}`;
}

export { getFirstName, getTodaysDate, greetMessage };
