@app.route('/upload_jewelry', methods=['POST'])
def upload_jewelry():
    if 'images' not in request.files:
        return jsonify({'error': 'No images uploaded'}), 400

    images = request.files.getlist('images')
    logger.info(f"Received {len(images)} images")

    upload_folder = os.path.join(app.static_folder, 'uploads')
    os.makedirs(upload_folder, exist_ok=True)

    saved_paths = []
    for img in images:
        save_path = os.path.join(upload_folder, img.filename)
        img.save(save_path)
        saved_paths.append(save_path)

    try:
        job_id = str(uuid.uuid4())
        job_output_dir = os.path.join(output_root, job_id)
        os.makedirs(job_output_dir, exist_ok=True)

        from src.utils.local_2d_to_3d import Local2DTo3DConverter
        converter = Local2DTo3DConverter(logger, output_root)

        # Convert images to 3D
        model_path = converter.convert(saved_paths, job_output_dir)
        logger.info(f"Model generated at: {model_path}")

        # Always return URL pointing to <job_output_dir>/output_model.obj
        model_url = f"/output/{job_id}/output_model.obj"
        return jsonify({"model_url": model_url})

    except Exception as e:
        logger.error(f"3D conversion failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500
