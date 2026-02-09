function submitHandler(event) {
  event.preventDefault();
  const container = event.target.parentNode;
  const form = container.querySelector(".newsletter-form");
  const formInput = container.querySelector(".newsletter-form-input");
  const success = container.querySelector(".newsletter-success");
  const errorContainer = container.querySelector(".newsletter-error");
  const errorMessage = container.querySelector(".newsletter-error-message");
  const backButton = container.querySelector(".newsletter-back-button");
  const submitButton = container.querySelector(".newsletter-form-button");
  const loadingButton = container.querySelector(".newsletter-loading-button");

  const rateLimit = () => {
    errorContainer.style.display = "flex";
    errorMessage.innerText = "Too many signups, please try again in a little while";
    submitButton.style.display = "none";
    formInput.style.display = "none";
    backButton.style.display = "block";
  };

  // Compare current time with time of previous sign up
  const time = new Date();
  const timestamp = time.valueOf();
  const previousTimestamp = localStorage.getItem("loops-form-timestamp");

  // If last sign up was less than a minute ago
  // display error
  if (previousTimestamp && Number(previousTimestamp) + 60000 > timestamp) {
    rateLimit();
    return;
  }
  localStorage.setItem("loops-form-timestamp", timestamp);

  submitButton.style.display = "none";
  loadingButton.style.display = "flex";

  const formBody = "userGroup=&email=" + encodeURIComponent(formInput.value);
  fetch(event.target.action, {
    method: "POST",
    body: formBody,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  })
    .then((res) => [res.ok, res.json(), res])
    .then(([ok, dataPromise, res]) => {
      if (ok) {
        // If response successful
        // display success
        success.style.display = "flex";
        form.reset();
      } else {
        // If response unsuccessful
        // display error message or response status
        dataPromise.then((data) => {
          errorContainer.style.display = "flex";
          errorMessage.innerText = data.message ? data.message : res.statusText;
        });
      }
    })
    .catch((error) => {
      // check for cloudflare error
      if (error.message === "Failed to fetch") {
        rateLimit();
        return;
      }
      // If error caught
      // display error message if available
      errorContainer.style.display = "flex";
      if (error.message) errorMessage.innerText = error.message;
      localStorage.setItem("loops-form-timestamp", "");
    })
    .finally(() => {
      formInput.style.display = "none";
      loadingButton.style.display = "none";
      backButton.style.display = "block";
    });
}
function resetFormHandler(event) {
  const container = event.target.parentNode;
  const formInput = container.querySelector(".newsletter-form-input");
  const success = container.querySelector(".newsletter-success");
  const errorContainer = container.querySelector(".newsletter-error");
  const errorMessage = container.querySelector(".newsletter-error-message");
  const backButton = container.querySelector(".newsletter-back-button");
  const submitButton = container.querySelector(".newsletter-form-button");

  success.style.display = "none";
  errorContainer.style.display = "none";
  errorMessage.innerText = "Oops! Something went wrong, please try again";
  backButton.style.display = "none";
  formInput.style.display = "flex";
  submitButton.style.display = "flex";
}

const formContainers = document.getElementsByClassName("newsletter-form-container");

for (let i = 0; i < formContainers.length; i++) {
  const formContainer = formContainers[i];
  const handlersAdded = formContainer.classList.contains("newsletter-handlers-added");
  if (handlersAdded) continue;
  formContainer.querySelector(".newsletter-form").addEventListener("submit", submitHandler);
  formContainer.querySelector(".newsletter-back-button").addEventListener("click", resetFormHandler);
  formContainer.classList.add("newsletter-handlers-added");
}
