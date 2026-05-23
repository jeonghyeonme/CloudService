import React, { useEffect, useMemo, useState } from "react";
import "./FormModal.css";

/**
 * @title 공통으로 사용 가능한 폼 모달 컴포넌트
 * @description 다양한 유형의 입력 필드를 지원하는 재사용 가능한 폼 모달입니다.
 * @props - open: 모달 열림 여부
 *       - title: 모달 제목
 */

const UploadIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 16V8" />
    <path d="M8.5 11.5 12 8l3.5 3.5" />
    <path d="M20 16.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5" />
  </svg>
);

function buildInitialValues(fields) {
  return fields.reduce((acc, field) => {
    acc[field.name] = field.defaultValue ?? (field.type === "file" ? null : "");
    return acc;
  }, {});
}

function FormModal({
  open,
  title,
  description,
  fields = [],
  submitLabel = "저장",
  cancelLabel = "취소",
  onClose,
  onSubmit,
  _embedded = false, // ✅ EntitySettingsModal 내부 임베드 시 overlay/헤더 숨김
}) {
  const initialValues = useMemo(() => buildInitialValues(fields), [fields]);
  const [values, setValues] = useState(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (open || _embedded) {
      setValues(initialValues);
      setSubmitError("");
    }
  }, [initialValues, open, _embedded]);

  if (!open && !_embedded) {
    return null;
  }

  const updateValue = (name, value) => {
    setValues((prev) => { 
      const nextValues = { ...prev, [name]: value };
      fields.forEach((field) => {
        if(field.showIf && !field.showIf(nextValues)) {
          nextValues[field.name] = field.defaultValue ?? (field.type === "file" ? null : "");
        }
      });
      return nextValues;
    });
  };

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    try {
      await onSubmit(values, {
        reset: () => setValues(buildInitialValues(fields)),
      });
    } catch (error) {
      setSubmitError(
        error.message || "요청을 처리하는 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field) => {
    const value = values[field.name];

    if (field.type === "textarea") {
      return (
        <textarea
          id={field.name}
          name={field.name}
          value={value}
          placeholder={field.placeholder}
          onChange={(event) => updateValue(field.name, event.target.value)}
          rows={field.rows || 4}
          required={field.required}
        />
      );
    }

    if (field.type === "select") {
      return (
        <select
          id={field.name}
          name={field.name}
          value={value}
          onChange={(event) => updateValue(field.name, event.target.value)}
          required={field.required}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "toggle") {
      return (
        <div
          className="form-modal__toggle-group"
          role="radiogroup"
          aria-label={field.label}
        >
          {field.options?.map((option) => (
            <button
              key={option.value}
              type="button"
              className={value === option.value ? "active" : ""}
              onClick={() => updateValue(field.name, option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      );
    }

    if (field.type === "file") {
      return (
        <label className="form-modal__upload-box" htmlFor={field.name}>
          <input
            id={field.name}
            name={field.name}
            type="file"
            accept={field.accept}
            onChange={(event) =>
              updateValue(field.name, event.target.files?.[0] || null)
            }
          />
          {value ? (
            <span className="form-modal__file-name">{value.name}</span>
          ) : (
            <>
              <span className="form-modal__upload-icon">
                <UploadIcon />
              </span>
              <p>
                {field.placeholder ||
                  "파일을 드래그하거나 클릭하여 업로드하세요"}
              </p>
            </>
          )}
        </label>
      );
    }

    return (
      <input
        id={field.name}
        name={field.name}
        type={field.type || "text"}
        value={value}
        placeholder={field.placeholder}
        onChange={(event) => updateValue(field.name, event.target.value)}
        required={field.required}
      />
    );
  };

  const formBody = (
    <form className="form-modal__form" onSubmit={handleSubmit}>
      {_embedded && description && <p style={{ fontSize: "13px", color: "#a1a1aa", margin: "0 0 12px" }}>{description}</p>}
      <div className="form-modal__grid">
        {fields
          .filter((field) => !field.showIf || field.showIf(values))
          .map((field) => (
            <div key={field.name} className={`form-modal__group ${field.width === "half" ? "form-modal__group--half" : ""}`}>
              <label htmlFor={field.name}>{field.label}</label>
              {renderField(field)}
              {field.helperText && <span className="form-modal__helper">{field.helperText}</span>}
            </div>
          ))}
      </div>
      <div className="form-modal__footer">
        {submitError ? <p className="form-modal__error">{submitError}</p> : <span className="form-modal__error-spacer" />}
        <div className="form-modal__actions">
          <button type="button" className="form-modal__button form-modal__button--ghost" onClick={onClose}>{cancelLabel}</button>
          <button type="submit" className="form-modal__button form-modal__button--primary" disabled={isSubmitting}>
            {isSubmitting ? "저장 중..." : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
 
  // ✅ 임베드 모드: overlay/헤더/닫기 버튼 없이 폼만 렌더링
  if (_embedded) return formBody;
 
  return (
    <div className="form-modal__overlay" onClick={handleOverlayClick}>
      <div className="form-modal">
        <button type="button" className="form-modal__close" onClick={onClose} aria-label="모달 닫기" disabled={isSubmitting}>✕</button>
        <div className="form-modal__header">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {formBody}
      </div>
    </div>
  );
}
 
    
export default FormModal;
