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

export { getFirstName, getTodaysDate };
