const express = require("express");
const app = express();
const port = 3000;
const fs = require("fs");
const { MongoClient, ServerApiVersion } = require("mongodb");
const path = require("path");

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

app.get("/api/questions", async (req, res) => {
  try {
    await client.connect();
    const dbName = "jsgoat";
    const collectionName = "js_output_questions";

    // Create references to the database and collection.
    const database = client.db(dbName);
    const collection = database.collection(collectionName);

    // Query the collection to get all documents.
    const documents = await collection.find({}).toArray();
    res.send(documents);

    console.log("documents", documents);
  } catch (err) {
    console.error(
      `Something went wrong trying to read the documents: ${err}\n`
    );
  } finally {
    await client.close();
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
