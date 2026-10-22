

const app = (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end("Dermatology Clinic Backend is running!");
};

export default app;