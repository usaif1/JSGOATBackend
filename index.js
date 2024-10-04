const express = require("express");
const app = express();
const port = 3000;
const fs = require("fs");
const { MongoClient, ServerApiVersion } = require("mongodb");
const path = require("path");
const NodeCache = require("node-cache");
const cors = require("cors");

const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour
// Use CORS to allow requests from your frontend
const corsOptions = {
  origin: "http://localhost:3000", // Frontend URL
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions)); // Enable CORS for this origin

const uri =
  "mongodb+srv://saif:URXy6WULU2vVmXJT@jsgoat.ldjhu.mongodb.net/?retryWrites=true&w=majority&appName=JSGOAT&tls=true";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db; // Store the database connection globally

async function connectToDatabase() {
  if (!db) {
    try {
      await client.connect();
      const dbName = "jsgoat";
      db = client.db(dbName); // Store the connected database
    } catch (err) {
      console.error("Error connecting to MongoDB:", err);
      throw err;
    }
  }
  return db;
}

function parseMarkdown(content) {
  const questions = [];
  const questionRegex =
    /###### (\d+)\. (.+)\n\n((?:```(?:javascript|html)\n[\s\S]+?```\n\n)?)((?:- [A-D]:[\s\S]+?)+)\n\n<details><summary><b>Answer<\/b><\/summary>\n<p>\n\n#### Answer: ([A-D])\n\n([\s\S]+?)\n\n<\/p>\n<\/details>\n\n---/g;

  let match;
  let matchCount = 0;
  while ((match = questionRegex.exec(content)) !== null) {
    matchCount++;
    const [, questionNumber, title, codeBlock, options, answer, explanation] =
      match;

    const parsedOptions = options
      .split("\n- ")
      .filter(Boolean)
      .map((option) => {
        const [id, ...valueParts] = option.split(":");
        return { id: id.trim(), value: valueParts.join(":").trim() };
      });

    questions.push({
      order: parseInt(questionNumber),
      questionNumber,
      title,
      codeBlock: codeBlock.trim() || null,
      options: JSON.stringify(parsedOptions),
      answer,
      explanation: explanation.trim(),
    });
  }

  return questions;
}

const parseData = async () => {
  try {
    const filePath = path.join(__dirname, "blocks.md");
    fs.readFile(filePath, "utf8", async (err, data) => {
      if (err) {
        console.log("error", err.message);
        throw err;
      }

      const jsonResult = parseMarkdown(data);
      console.log("jsonResult", jsonResult);

      try {
        await client.connect();
        const dbName = "jsgoat";
        const collectionName = "js_output_questions";

        // Create references to the database and collection in order to run
        // operations on them.
        const database = client.db(dbName);
        const collection = database.collection(collectionName);

        const insertManyResult = await collection.insertMany(jsonResult);
        console.log(
          `${insertManyResult.insertedCount} documents successfully inserted.\n`
        );
      } catch (err) {
        console.error(
          `Something went wrong trying to insert the new documents: ${err}\n`
        );
      }

      // Write result to a JSON file
      fs.writeFile(
        "output.json",
        JSON.stringify(jsonResult, null, 2),
        (err) => {
          if (err) throw err;
          console.log("JSON file has been saved!");
        }
      );
    });
  } finally {
    await client.close();
  }
};

app.get("/", (req, res) => {
  const response = {
    data: "hello world!",
  };
  res.send(JSON.stringify(response));
});

app.get("/api/add-questions", (req, res) => {
  parseData();

  res.send("parsing data");
});

// In your API endpoint:
app.get("/api/questions", async (req, res) => {
  const cachedQuestions = cache.get("questions");

  if (cachedQuestions) {
    return res.send(cachedQuestions);
  }

  try {
    const database = await connectToDatabase(); // Reuse the connection
    const collection = database.collection("js_output_questions");
    const documents = await collection.find({}).toArray();

    cache.set("questions", documents);
    res.send(documents);
  } catch (err) {
    console.error(
      `Something went wrong trying to read the documents: ${err}\n`
    );
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
