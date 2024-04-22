const fs = require("fs");
const path = require("path");
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const Page = require("../models/page");
const User = require("../models/user");

const getPages = async (req, res, next) => {
  const userId = req.userId;

  try {
    if (!userId) {
      const err = new Error("User is not authenticated.");
      err.statusCode = 401;
      throw err;
    }

    const user = await User.findById(userId);

    if (!user) {
      const err = new Error("Could not find user by id.");
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      message: "Fetched pages successfully.",
      pages: user.pages.map((page) => page.toString()),
    });
  } catch (err) {
    next(err);
  }
};

const getPage = async (req, res, next) => {
  const userId = req.userId;
  const pageId = req.params.pageId;
  console.log('what is pageId', pageId, typeof pageId);
  try {
    if (pageId == 'undefined') {
      const err = new Error("Could not find page by undefined id.");
      err.statusCode = 404;
      throw err;
    }
    const page = await Page.findById(pageId);
    if (!page) {
      const err = new Error("Could not find page by id.");
      err.statusCode = 404;
      throw err;
    }

    // Public pages have no creator, they can be accessed by anybody
    // For private pages, creator and logged-in user have to be the same
    const creatorId = page.creator ? page.creator.toString() : null;
    if ((creatorId && creatorId === userId) || !creatorId) {
      res.status(200).json({
        message: "Fetched page successfully.",
        page: page,
      });
    } else {
      const err = new Error("User is not authenticated.");
      err.statusCode = 401;
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

const postPage = async (req, res, next) => {
  const userId = req.userId;
  const blocks = req.body.blocks;
  console.log('is this being called early?', userId, blocks)
  const page = new Page({
    blocks: blocks,
    creator: userId || null,
  });
  try {
    const savedPage = await page.save();

    // Update user collection too
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        const err = new Error("Could not find user by id.");
        err.statusCode = 404;
        throw err;
      }
      user.pages.push(savedPage._id);
      await user.save();
    }

    res.status(201).json({
      message: "Created page successfully.",
      pageId: savedPage._id.toString(),
      blocks: blocks,
      creator: userId || null,
    });
  } catch (err) {
    next(err);
  }
};

const putPage = async (req, res, next) => {
  const userId = req.userId;
  const pageId = req.params.pageId;
  const blocks = req.body.blocks;

  try {
    const page = await Page.findById(pageId);

    if (!page) {
      const err = new Error("Could not find page by id.");
      err.statusCode = 404;
      throw err;
    }

    // Public pages have no creator, they can be updated by anybody
    // For private pages, creator and logged-in user have to be the same
    const creatorId = page.creator ? page.creator.toString() : null;
    if ((creatorId && creatorId === userId) || !creatorId) {
      page.blocks = blocks;
      const savedPage = await page.save();
      res.status(200).json({
        message: "Updated page successfully.",
        page: savedPage,
      });
    } else {
      const err = new Error("User is not authenticated.");
      err.statusCode = 401;
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

const deletePage = async (req, res, next) => {
  const userId = req.userId;
  const pageId = req.params.pageId;

  try {
    const page = await Page.findById(pageId);

    if (!page) {
      const err = new Error("Could not find page by id.");
      err.statusCode = 404;
      throw err;
    }

    // Public pages have no creator, they can be deleted by anybody
    // For private pages, creator and logged-in user have to be the same
    const creatorId = page.creator ? page.creator.toString() : null;
    if ((creatorId && creatorId === userId) || !creatorId) {
      const deletedPage = await Page.findByIdAndDelete(pageId);

      // Update user collection too
      if (creatorId) {
        const user = await User.findById(userId);
        if (!user) {
          const err = new Error("Could not find user by id.");
          err.statusCode = 404;
          throw err;
        }
        user.pages.splice(user.pages.indexOf(deletedPage._id), 1);
        await user.save();
      }

      // Delete images folder too (if exists)
      const dir = `images/${pageId}`;
      fs.access(dir, (err) => {
        // If there is no error, the folder does exist
        if (!err && dir !== "images/") {
          fs.rmdirSync(dir, { recursive: true });
        }
      });

      res.status(200).json({
        message: "Deleted page successfully.",
      });
    } else {
      const err = new Error("User is not authenticated.");
      err.statusCode = 401;
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

const postImage = (req, res, next) => {
  if (req.file) {
    const imageUrl = req.file.path;
    res.status(200).json({
      message: "Image uploaded successfully!",
      imageUrl: imageUrl,
    });
  } else {
    const error = new Error("No image file provided.");
    error.statusCode = 422;
    throw error;
  }
};

const deleteImage = (req, res, next) => {
  const imageName = req.params.imageName;
  if (imageName) {
    const imagePath = `images/${imageName}`;
    clearImage(imagePath);
    res.status(200).json({
      message: "Deleted image successfully.",
    });
  } else {
    const error = new Error("No imageName provided.");
    error.statusCode = 422;
    throw error;
  }
};

const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => console.log(err));
};

const answerQuestion = async (req, res, next) => {
  const embedding = await createEmbedding(req.body.question);

  const notes = await Page.find().limit(3).sort({ $vector: { $meta: embedding } });

  const prompt = `You are a helpful assistant that summarizes relevant notes to help answer a user's questions.
  Given the following notes, answer the user's question.
  
  ${notes.map(note => 'Note: ' + note.content).join('\n\n')}
  `.trim();
  const answers = await makeChatGPTRequest(prompt, req.body.question);
  return res.status(200).json({ sources: notes.map(x => ({ blocks: x.blocks, createdAt: new Date(x.createdAt).toDateString(), updatedAt: new Date(x.updatedAt).toDateString() })), answer: answers })
};

exports.getPages = getPages;
exports.getPage = getPage;
exports.postPage = postPage;
exports.putPage = putPage;
exports.deletePage = deletePage;
exports.postImage = postImage;
exports.deleteImage = deleteImage;
exports.answerQuestion = answerQuestion;

function createEmbedding(input) {
  return axios({
    method: 'POST',
    url: 'https://api.openai.com/v1/embeddings',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    data: {
      model: 'text-embedding-ada-002',
      input
    }
  }).then(res => res.data.data[0].embedding);
}

function makeChatGPTRequest(systemPrompt, question) {
  const options = {
    method: 'POST',
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    data: {
      model: 'gpt-3.5-turbo-1106',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ]
    }
  };

  return axios(options).then(res => res.data);
}
