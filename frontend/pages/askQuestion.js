import { useState, useContext } from "react";
import { useRouter } from "next/router";
import cookies from "next-cookies";

import { UserDispatchContext } from "../context/UserContext";
import Notice from "../components/notice";
import Input from "../components/input";

const form = {
  id: "question-form",
  inputs: [
    {
      id: "question",
      type: "text",
      label: "Question",
      required: true,
      value: "",
    },
  ],
  submitButton: {
    type: "submit",
    label: "ask",
  },
};

const askQuestionPage = () => {
  const RESET_NOTICE = { type: "", message: "" };
  const [notice, setNotice] = useState(RESET_NOTICE);
  const dispatch = useContext(UserDispatchContext);
  const router = useRouter();

  const values = {};
  form.inputs.forEach((input) => (values[input.id] = input.value));
  const [formData, setFormData] = useState(values);

  const handleInputChange = (id, value) => {
    setFormData({ ...formData, [id]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotice(RESET_NOTICE);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API}/pages/question`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: formData.question
          }),
        }
      );
      const data = await response.json();
      if (data.errCode) {
        setNotice({ type: "ERROR", message: data.message });
      } else {
        dispatch({ type: "question" });
        setNotice({ type: 'question', sources: data.sources, answer: data.answer });
        // router.push("/pages");
      }
    } catch (err) {
      console.log(err);
      setNotice({ type: "ERROR", message: "Something unexpected happened." });
      dispatch({ type: "LOGOUT" });
    }
  };

  return (
    <>
      <h1 className="pageHeading">Login</h1>
      <form id={form.id} onSubmit={handleSubmit}>
        {form.inputs.map((input, key) => {
          return (
            <Input
              key={key}
              formId={form.id}
              id={input.id}
              type={input.type}
              label={input.label}
              required={input.required}
              value={formData[input.id]}
              setValue={(value) => handleInputChange(input.id, value)}
            />
          );
        })}
        {notice.message && (
          <Notice status={notice.type} mini>
            {notice.message}
          </Notice>
        )}
        <button type={form.submitButton.type}>{form.submitButton.label}</button>
      </form>
      {notice.answer && (
        <div>
          <p>{notice.answer}</p>
          <p>{notice.sources}</p>
        </div>
      )}
    </>
  );
};

export const getServerSideProps = (context) => {
  const { token } = cookies(context);
  const res = context.res;
  if (token) {
    res.writeHead(302, { Location: `/account` });
    res.end();
  }
  return { props: {} };
};

export default askQuestionPage;
