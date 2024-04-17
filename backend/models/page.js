const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const stargate_mongoose = require('stargate-mongoose');
mongoose.setDriver(stargate_mongoose.driver);
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });
const parser = require ('node-html-parser');

const pageSchema = new Schema(
  {
    blocks: [
      {
        tag: {
          type: String,
          required: true,
        },
        html: {
          type: String,
          required: false,
        },
        imageUrl: {
          type: String,
          required: false,
        },
      },
    ],
    creator: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    $vector: {
      type: [Number]
    }
  },
  { timestamps: true }
);

// I believe the backend is set up that every entry creates a new block, including the initial creation of hitting the button
pageSchema.pre('save', async function() {
  /*
  if (!this.isNew) {
    return;
  }
  */
  console.log('yo') // culprit is here. Need this to not execute when we hit create note
  console.log('what is this', this);
  this.$vector = [-1];
  let text = '';
  for (let i = 0; i < this.blocks.length; i++) {
    if (this.blocks[i].html == '') return;
    text += parser.parse(this.blocks[i].html).textContent;
  };


  // generate embeddings here
  const data = await axios({
    method: 'POST',
    url: 'https://api.openai.com/v1/embeddings',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    data: {
      model: 'text-embedding-ada-002',
      input: text
    }
  }).then(res => res.data.data[0].embedding);
  console.log('================================================')
  console.log('what is data', data);
  if (data) {
    this.$vector = data;
  }
});


module.exports = mongoose.model("Page", pageSchema);
