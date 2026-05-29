const ErrorMessage = ({ message }) => {
  if (!message) return null;

  return (
    <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-md mb-3">
      {message}
    </div>
  );
};

export default ErrorMessage;