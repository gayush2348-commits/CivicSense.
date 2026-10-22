import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { categories, severityPriorityScores } from "./data/sampleData.js";

export default function ComplaintForm({ onSubmit, onCancel }) {
  const [formError, setFormError] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const photoUrlRef = useRef("");

  useEffect(() => {
    return () => {
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
      }
    };
  }, []);

  function handlePhotoChange(event) {
    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
    }

    const nextPhoto = event.target.files?.[0] || null;

    if (nextPhoto) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

      if (!allowedTypes.includes(nextPhoto.type)) {
        event.target.value = "";
        setPhoto(null);
        setPhotoUrl("");
        photoUrlRef.current = "";
        setFormError("Please select a JPG, PNG, or WebP image.");
        return;
      }

      if (nextPhoto.size > 5 * 1024 * 1024) {
        event.target.value = "";
        setPhoto(null);
        setPhotoUrl("");
        photoUrlRef.current = "";
        setFormError("Image size must be 5 MB or less.");
        return;
      }
    }

    const nextUrl = nextPhoto ? URL.createObjectURL(nextPhoto) : "";

    photoUrlRef.current = nextUrl;
    setPhoto(nextPhoto);
    setPhotoUrl(nextUrl);
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const values = {
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      category: String(formData.get("category") || ""),
      location: String(formData.get("location") || "").trim(),
      severity: String(formData.get("severity") || ""),
      imageFileName: photo?.name || "",
    };

    if (
      !values.title ||
      !values.description ||
      !values.category ||
      !values.location ||
      !values.severity
    ) {
      setFormError("Please complete all required fields.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const payload = new FormData();

      // Backend accepts description, category, address and image.
      // Preserve the form title in the saved description as well.
      payload.append(
        "description",
        `Title: ${values.title}\n\n${values.description}`,
      );
      payload.append("category", values.category);
      payload.append("address", values.location);

      if (photo) {
        payload.append("image", photo);
      }

      const response = await fetch("/api/complaints", {
        method: "POST",
        credentials: "include",
        body: payload,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            "Your session may have expired. Please log in again.",
          );
        }

        throw new Error(
          data.message ||
            data.error ||
            "Unable to submit the complaint. Please try again.",
        );
      }

      const savedComplaint =
        data.complaint ||
        data.data?.complaint ||
        data.data ||
        data.report ||
        data;

      if (
        !savedComplaint ||
        (!savedComplaint._id &&
          !savedComplaint.id &&
          !savedComplaint.description)
      ) {
        throw new Error(
          "The server response did not contain the saved complaint. Check the API response.",
        );
      }

      // Only update the dashboard after the backend has accepted the report.
      onSubmit({
        ...values,
        serverComplaint: savedComplaint,
      });
    } catch (error) {
      setFormError(
        error.message ||
          "Something went wrong while submitting your complaint.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onCancel();
        }
      }}
    >
      <section
        className="form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complaint-form-heading"
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">CIVIC ISSUE INTAKE</p>
            <h2 id="complaint-form-heading">Report a new issue</h2>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Close report form"
          >
            <Icon name="close" />
          </button>
        </div>

        <p className="form-intro">
          Share a few details to help the response team review and prioritize
          this issue.
        </p>

        <form className="complaint-form" onSubmit={handleSubmit}>
          <label className="form-field form-full">
            <span>
              Complaint title <b>*</b>
            </span>
            <input
              name="title"
              required
              maxLength={150}
              placeholder="e.g. Water leakage near Hostel Block B"
            />
          </label>

          <label className="form-field form-full">
            <span>
              Description <b>*</b>
            </span>
            <textarea
              name="description"
              required
              maxLength={5000}
              rows="4"
              placeholder="Describe what happened and who may be affected..."
            />
          </label>

          <label className="form-field">
            <span>
              Category <b>*</b>
            </span>
            <select name="category" required defaultValue="">
              <option value="" disabled>
                Select a category
              </option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>
              Severity <b>*</b>
            </span>
            <select name="severity" required defaultValue="">
              <option value="" disabled>
                Select severity
              </option>
              {Object.keys(severityPriorityScores).map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field form-full">
            <span>
              Location <b>*</b>
            </span>
            <input
              name="location"
              required
              maxLength={500}
              placeholder="Street, landmark, or area"
            />
          </label>

          <label className="form-field form-full">
            <span>
              Photo <small>Optional</small>
            </span>
            <input
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
            />

            {photoUrl && (
              <img
                className="photo-preview"
                src={photoUrl}
                alt="Selected complaint attachment preview"
              />
            )}

            <small>
              JPG, PNG or WebP. Maximum size: 5 MB. The selected photo will be
              uploaded with your report.
            </small>
          </label>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="modal-actions form-full">
            <button
              className="button button-secondary"
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              className="button button-primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                "Submitting..."
              ) : (
                <>
                  <Icon name="plus" size={17} />
                  Submit complaint
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
